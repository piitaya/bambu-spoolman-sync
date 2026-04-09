import type { AmsSlot } from "../domain/spool.js";

export interface SyncStateEntry {
  status: "synced" | "error";
  at: string;
  signature: string;
  spool_id?: number;
  error?: string;
}

export type SyncStateStore = Map<string, SyncStateEntry>;

export function createSyncStateStore(): SyncStateStore {
  return new Map();
}

export function syncStateKey(
  serial: string,
  amsId: number,
  slotId: number,
): string {
  return `${serial}#${amsId}#${slotId}`;
}

export function slotSignature(slot: AmsSlot): string {
  return `${slot.spool?.uid ?? ""}|${slot.spool?.remain ?? ""}`;
}

export type SlotSyncView =
  | { status: "never" }
  | { status: "synced"; spool_id: number; at: string }
  | { status: "stale"; spool_id: number; at: string }
  | { status: "error"; error: string; at: string };

export function getSlotSyncView(
  store: SyncStateStore,
  slot: AmsSlot,
): SlotSyncView {
  const entry = store.get(
    syncStateKey(slot.printer_serial, slot.ams_id, slot.slot_id),
  );
  if (!entry) return { status: "never" };
  if (entry.status === "error") {
    return { status: "error", error: entry.error ?? "", at: entry.at };
  }
  const current = slotSignature(slot);
  if (current !== entry.signature) {
    return { status: "stale", spool_id: entry.spool_id!, at: entry.at };
  }
  return { status: "synced", spool_id: entry.spool_id!, at: entry.at };
}
