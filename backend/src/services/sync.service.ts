import type { AmsSlot, Spool } from "../domain/spool.js";
import { matchSpool, type FilamentEntry } from "../domain/matcher.js";
import {
  type SyncStateStore,
  syncStateKey,
  slotSignature,
} from "../stores/sync-state.store.js";
import {
  type SpoolmanClient,
  type SpoolmanSpool,
  createSpoolmanClient,
  decodeExtraString,
} from "../clients/spoolman.client.js";
import { type MqttState, listRuntimes } from "../clients/bambu.client.js";
import type { AppContext } from "../context.js";
import { errorMessage } from "../utils.js";

export type SkipReason =
  | "not_matched"
  | "no_spool"
  | "missing_uid"
  | "missing_weight"
  | "missing_remain";

export interface SpoolSyncResult {
  spool_id: number;
  used_weight: number | null;
  created_filament: boolean;
  created_spool: boolean;
}

export interface SyncOutcome {
  printer_serial: string;
  ams_id: number;
  slot_id: number;
  spool_id: number;
  used_weight: number | null;
  created_filament: boolean;
  created_spool: boolean;
}

export interface SyncAllResult {
  synced: SyncOutcome[];
  skipped: Array<{
    printer_serial: string;
    ams_id: number;
    slot_id: number;
    reason: string;
  }>;
  errors: Array<{
    printer_serial: string;
    ams_id: number;
    slot_id: number;
    error: string;
  }>;
}

function computeUsedWeight(weight: number, remain: number): number {
  return Math.max(0, weight * (1 - remain / 100));
}

export function evaluateSpoolForSync(
  spool: Spool | null,
  mapping: Map<string, FilamentEntry>,
):
  | { ok: true; spoolmanId: string; weight: number; usedWeight: number }
  | { ok: false; reason: SkipReason } {
  if (!spool) return { ok: false, reason: "no_spool" };
  const match = matchSpool(spool, mapping);
  if (match.type !== "matched" || !match.entry?.spoolman_id) {
    return { ok: false, reason: "not_matched" };
  }
  if (!spool.uid) return { ok: false, reason: "missing_uid" };
  if (spool.weight == null) return { ok: false, reason: "missing_weight" };
  if (spool.remain == null) return { ok: false, reason: "missing_remain" };
  const weight = spool.weight;
  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, reason: "missing_weight" };
  }
  return {
    ok: true,
    spoolmanId: match.entry.spoolman_id,
    weight,
    usedWeight: computeUsedWeight(weight, spool.remain),
  };
}

async function syncOneSpool(
  client: SpoolmanClient,
  spool: Spool,
  spoolmanId: string,
  usedWeight: number | null,
  options: { archiveOnEmpty: boolean },
  allSpools?: SpoolmanSpool[],
): Promise<SpoolSyncResult> {
  let createdFilament = false;
  let filament = await client.findFilamentByExternalId(spoolmanId);
  if (!filament) {
    filament = await client.createFilamentFromExternal(spoolmanId);
    createdFilament = true;
  }

  const uid = spool.uid!;
  const spoolmanSpools = allSpools ?? await client.listSpools();
  let spoolmanSpool =
    spoolmanSpools.find((s) => decodeExtraString(s.extra?.tag) === uid) ?? null;
  let createdSpool = false;
  if (!spoolmanSpool) {
    spoolmanSpool = await client.createSpool(filament.id, uid);
    createdSpool = true;
  }

  const now = new Date().toISOString();
  const shouldArchive = options.archiveOnEmpty && spool.remain === 0;
  await client.updateSpool(spoolmanSpool.id, {
    ...(usedWeight != null ? { used_weight: usedWeight } : {}),
    last_used: now,
    ...(spoolmanSpool.first_used ? {} : { first_used: now }),
    ...(shouldArchive ? { archived: true } : {}),
  });
  return {
    spool_id: spoolmanSpool.id,
    used_weight: usedWeight,
    created_filament: createdFilament,
    created_spool: createdSpool,
  };
}

export async function syncSpool(
  spool: Spool,
  mapping: Map<string, FilamentEntry>,
  spoolmanUrl: string,
  options: { archiveOnEmpty: boolean } = { archiveOnEmpty: false },
  clientFactory: (url: string) => SpoolmanClient = createSpoolmanClient,
): Promise<SpoolSyncResult> {
  if (!spool.uid) throw new Error("Spool has no UID.");
  const match = matchSpool(spool, mapping);
  if (match.type !== "matched" || !match.entry?.spoolman_id) {
    throw new Error(`Spool cannot be synced: not_matched.`);
  }
  let usedWeight: number | null = null;
  if (spool.weight != null && spool.remain != null) {
    const w = spool.weight;
    if (Number.isFinite(w) && w > 0) {
      usedWeight = computeUsedWeight(w, spool.remain);
    }
  }
  const client = clientFactory(spoolmanUrl);
  return syncOneSpool(
    client,
    spool,
    match.entry.spoolman_id,
    usedWeight,
    options,
  );
}

function findSlot(
  mqttState: MqttState,
  printerSerial: string,
  amsId: number,
  slotId: number,
): AmsSlot | null {
  const client = mqttState.get(printerSerial);
  if (!client) return null;
  const unit = client.ams_units.find((u) => u.id === amsId);
  if (!unit) return null;
  return unit.slots.find((s) => s.slot_id === slotId) ?? null;
}

function recordSyncSuccess(
  syncState: SyncStateStore,
  key: string,
  slot: AmsSlot,
  spoolId: number,
): void {
  syncState.set(key, {
    status: "synced",
    at: new Date().toISOString(),
    signature: slotSignature(slot),
    spool_id: spoolId,
  });
}

function recordSyncError(
  syncState: SyncStateStore,
  key: string,
  slot: AmsSlot,
  error: string,
): void {
  syncState.set(key, {
    status: "error",
    at: new Date().toISOString(),
    signature: slotSignature(slot),
    error,
  });
}

export async function syncSlot(
  ctx: AppContext,
  printerSerial: string,
  amsId: number,
  slotId: number,
  clientFactory: (url: string) => SpoolmanClient = createSpoolmanClient,
): Promise<SyncOutcome> {
  const url = ctx.config.spoolman.url;
  if (!url) throw new Error("Spoolman URL is not configured.");

  const slot = findSlot(ctx.mqttState, printerSerial, amsId, slotId);
  if (!slot) {
    throw new Error(
      `Slot ${amsId}/${slotId} on printer ${printerSerial} is not available.`,
    );
  }
  const evaluated = evaluateSpoolForSync(slot.spool, ctx.mapping.byId);
  if (!evaluated.ok) {
    throw new Error(`Slot cannot be synced: ${evaluated.reason}.`);
  }
  const key = syncStateKey(printerSerial, amsId, slotId);
  try {
    const client = clientFactory(url);
    const outcome = await syncOneSpool(
      client,
      slot.spool!,
      evaluated.spoolmanId,
      evaluated.usedWeight,
      { archiveOnEmpty: ctx.config.spoolman.archive_on_empty ?? false },
    );
    recordSyncSuccess(ctx.syncState, key, slot, outcome.spool_id);
    return {
      printer_serial: printerSerial,
      ams_id: amsId,
      slot_id: slotId,
      ...outcome,
    };
  } catch (err) {
    recordSyncError(
      ctx.syncState,
      key,
      slot,
      errorMessage(err),
    );
    throw err;
  }
}

export async function syncAll(
  ctx: AppContext,
  clientFactory: (url: string) => SpoolmanClient = createSpoolmanClient,
): Promise<SyncAllResult> {
  const url = ctx.config.spoolman.url;
  if (!url) throw new Error("Spoolman URL is not configured.");
  const client = clientFactory(url);
  const options = {
    archiveOnEmpty: ctx.config.spoolman.archive_on_empty ?? false,
  };

  // Pre-fetch once to avoid N+1 HTTP calls per slot
  const allSpools = await client.listSpools();

  const result: SyncAllResult = { synced: [], skipped: [], errors: [] };
  for (const runtime of listRuntimes(ctx.mqttState)) {
    for (const unit of runtime.ams_units) {
      for (const slot of unit.slots) {
        const evaluated = evaluateSpoolForSync(slot.spool, ctx.mapping.byId);
        if (!evaluated.ok) {
          result.skipped.push({
            printer_serial: runtime.printer.serial,
            ams_id: slot.ams_id,
            slot_id: slot.slot_id,
            reason: evaluated.reason,
          });
          continue;
        }
        const key = syncStateKey(
          runtime.printer.serial,
          slot.ams_id,
          slot.slot_id,
        );
        try {
          const outcome = await syncOneSpool(
            client,
            slot.spool!,
            evaluated.spoolmanId,
            evaluated.usedWeight,
            options,
            allSpools,
          );
          recordSyncSuccess(ctx.syncState, key, slot, outcome.spool_id);
          result.synced.push({
            printer_serial: runtime.printer.serial,
            ams_id: slot.ams_id,
            slot_id: slot.slot_id,
            ...outcome,
          });
        } catch (err) {
          const message = errorMessage(err);
          recordSyncError(ctx.syncState, key, slot, message);
          result.errors.push({
            printer_serial: runtime.printer.serial,
            ams_id: slot.ams_id,
            slot_id: slot.slot_id,
            error: message,
          });
        }
      }
    }
  }
  return result;
}
