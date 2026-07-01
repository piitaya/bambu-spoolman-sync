import type { SpoolReading } from "@pandaroo/shared";
import type { AmsLocation, Printer, Spool } from "../api";
import { usePrinters, useSpools } from "./queries";

// Share derived Maps across callers — keyed by array identity, which React
// Query keeps stable across refetches via structural sharing.
const EMPTY_SPOOLS: readonly Spool[] = [];
const EMPTY_PRINTERS: readonly Printer[] = [];

interface AmsSlotInfo {
  location: AmsLocation;
  reading: SpoolReading;
}

const spoolMapCache = new WeakMap<readonly Spool[], Map<string, Spool>>();
const slotInfoCache = new WeakMap<
  readonly Printer[],
  Map<string, AmsSlotInfo>
>();
const loadedTagsCache = new WeakMap<readonly Printer[], Set<string>>();

function buildSpoolMap(spools: readonly Spool[]): Map<string, Spool> {
  let map = spoolMapCache.get(spools);
  if (!map) {
    map = new Map(spools.map((s) => [s.tag_id, s]));
    spoolMapCache.set(spools, map);
  }
  return map;
}

function buildSlotInfoMap(
  printers: readonly Printer[],
): Map<string, AmsSlotInfo> {
  let map = slotInfoCache.get(printers);
  if (map) return map;
  map = new Map();
  for (const printer of printers) {
    for (const unit of printer.ams_units) {
      for (const slot of unit.slots) {
        const reading = slot.reading;
        if (!reading?.tag_id) continue;
        map.set(reading.tag_id, {
          location: {
            printer_serial: printer.serial,
            printer_name: printer.name,
            ams_id: unit.id,
            slot_id: slot.slot_id,
          },
          reading,
        });
      }
    }
  }
  slotInfoCache.set(printers, map);
  return map;
}

export function useSpoolMap(): Map<string, Spool> {
  const { data: spools } = useSpools();
  return buildSpoolMap(spools ?? EMPTY_SPOOLS);
}

export function useSpoolLocation(tagId: string): AmsLocation | null {
  const { data: printers } = usePrinters();
  return (
    buildSlotInfoMap(printers ?? EMPTY_PRINTERS).get(tagId)?.location ?? null
  );
}

export function useLoadedTagIds(): ReadonlySet<string> {
  const { data: printers } = usePrinters();
  const key = printers ?? EMPTY_PRINTERS;
  let set = loadedTagsCache.get(key);
  if (!set) {
    set = new Set();
    for (const printer of key) {
      for (const unit of printer.ams_units) {
        for (const slot of unit.slots) {
          const tag = slot.reading?.tag_id;
          if (tag) set.add(tag);
        }
      }
    }
    loadedTagsCache.set(key, set);
  }
  return set;
}

// True when the tag's AMS slot reports a remain value (not AMS Lite).
export function useSpoolReportsRemain(tagId: string): boolean {
  const { data: printers } = usePrinters();
  return (
    buildSlotInfoMap(printers ?? EMPTY_PRINTERS).get(tagId)?.reading.remain !=
    null
  );
}

export function useSlotSpool(
  tagId: string | null | undefined,
): Spool | undefined {
  const spoolMap = useSpoolMap();
  return tagId ? spoolMap.get(tagId) : undefined;
}
