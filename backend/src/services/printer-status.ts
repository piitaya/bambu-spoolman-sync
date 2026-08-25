import type { AmsSlot, Printer } from "@pandaroo/shared";
import { matchSlot, type Mapping } from "../filament-catalog.js";
import type { ConfigStore } from "../config-store.js";
import {
  listRuntimes,
  type PrinterConnectionPool,
} from "../clients/bambu/index.js";

export interface PrinterStatusDeps {
  configStore: ConfigStore;
  mapping: Mapping;
  printerPool: PrinterConnectionPool;
}

export function listPrinterStatuses({
  configStore,
  mapping,
  printerPool,
}: PrinterStatusDeps): Printer[] {
  const runtimes = listRuntimes(printerPool);
  const bySerial = new Map(runtimes.map((r) => [r.printer.serial, r]));

  return configStore.current.printers.map((p) => {
    const runtime = bySerial.get(p.serial);
    const ams_units = (runtime?.ams_units ?? []).map((unit) => ({
      id: unit.id,
      nozzle_id: unit.nozzle_id,
      slots: unit.slots.map((slot): AmsSlot => {
        const match = matchSlot(slot, mapping.byId);
        return {
          ams_id: slot.ams_id,
          slot_id: slot.slot_id,
          nozzle_id: slot.nozzle_id,
          has_spool: slot.has_spool,
          reading: slot.spool,
          match_type: match.type,
          color_name: match.entry?.color_name ?? null,
        };
      }),
    }));

    return {
      serial: p.serial,
      name: p.name,
      enabled: p.enabled,
      status: runtime?.status ?? { lastError: null, errorCode: null },
      ams_units,
    };
  });
}
