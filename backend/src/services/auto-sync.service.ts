import type { AmsUnit } from "../domain/spool.js";
import type { Printer } from "../stores/config.store.js";
import {
  syncStateKey,
  slotSignature,
} from "../stores/sync-state.store.js";
import { evaluateSpoolForSync, syncSlot } from "./sync.service.js";
import type { AppContext } from "../context.js";

interface Logger {
  warn(obj: object, msg: string): void;
}

export function createAutoSync(ctx: AppContext, log: Logger) {
  const lastSyncSignature = new Map<string, string>();
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  const onAmsUpdate = (printer: Printer, ams_units: AmsUnit[]) => {
    if (!ctx.config.spoolman.auto_sync || !ctx.config.spoolman.url) {
      return;
    }
    for (const unit of ams_units) {
      for (const slot of unit.slots) {
        const evaluated = evaluateSpoolForSync(slot.spool, ctx.mapping.byId);
        if (!evaluated.ok) continue;
        const key = syncStateKey(printer.serial, slot.ams_id, slot.slot_id);
        const signature = slotSignature(slot);
        if (lastSyncSignature.get(key) === signature) continue;
        if (debounceTimers.has(key)) continue;
        debounceTimers.set(
          key,
          setTimeout(() => {
            debounceTimers.delete(key);
            lastSyncSignature.set(key, signature);
            syncSlot(ctx, printer.serial, slot.ams_id, slot.slot_id).catch(
              (err) => {
                lastSyncSignature.delete(key);
                log.warn(
                  {
                    err,
                    serial: printer.serial,
                    ams: slot.ams_id,
                    slot: slot.slot_id,
                  },
                  "auto-sync failed",
                );
              },
            );
          }, 2000),
        );
      }
    }
  };

  const stop = () => {
    for (const timer of debounceTimers.values()) clearTimeout(timer);
    debounceTimers.clear();
  };

  return { onAmsUpdate, stop };
}
