import { describe, expect, it } from "vitest";
import { matchSlot, type AMSSlot, type FilamentEntry } from "./matcher.js";

const mapping = new Map<string, FilamentEntry>([
  ["A01-B6", { id: "A01-B6", spoolman_id: "bambulab_pla_matte_darkblue" }],
  ["A18-B0", { id: "A18-B0", spoolman_id: null }]
]);

const baseSlot = (over: Partial<AMSSlot> = {}): AMSSlot => ({
  printer_serial: "AC12",
  ams_id: 0,
  nozzle_id: 0,
  slot_id: 0,
  tray_id_name: "A01-B6",
  tray_sub_brands: "PLA Matte",
  tray_type: "PLA",
  tray_color: "042F56FF",
  tray_colors: null,
  tray_uuid: "UUID1",
  nozzle_temp_min: 220,
  nozzle_temp_max: 240,
  tray_weight: "1000",
  remain: 80,
  present: true,
  ...over
});

describe("matchSlot", () => {
  it("matches a known variant with a spoolman_id", () => {
    const r = matchSlot(baseSlot(), mapping);
    expect(r.type).toBe("matched");
    expect(r.entry?.id).toBe("A01-B6");
  });

  it("returns known_unmapped when variant exists but spoolman_id is null", () => {
    const r = matchSlot(baseSlot({ tray_id_name: "A18-B0" }), mapping);
    expect(r.type).toBe("known_unmapped");
    expect(r.entry?.id).toBe("A18-B0");
  });

  it("returns unknown_variant for an id not in the mapping", () => {
    const r = matchSlot(baseSlot({ tray_id_name: "ZZ-99" }), mapping);
    expect(r.type).toBe("unknown_variant");
    expect(r.entry).toBeUndefined();
  });

  it("returns third_party when tray_id_name is missing but other tray fields exist", () => {
    const r = matchSlot(
      baseSlot({ tray_id_name: null, tray_sub_brands: "Generic PLA" }),
      mapping
    );
    expect(r.type).toBe("third_party");
  });

  it("returns empty when the slot has no filament at all", () => {
    const r = matchSlot(
      {
        printer_serial: "AC12",
        ams_id: 0,
        slot_id: 1,
        tray_id_name: null,
        tray_sub_brands: null,
        tray_type: null,
        tray_color: null,
        tray_uuid: null,
        nozzle_temp_min: null,
        nozzle_temp_max: null,
        tray_weight: null,
        remain: null
      },
      mapping
    );
    expect(r.type).toBe("empty");
  });

  it("does not try to match by color or name", () => {
    // Same material, same color, wrong variant id → no match.
    const r = matchSlot(
      baseSlot({ tray_id_name: "A01-B7", tray_color: "042F56FF" }),
      mapping
    );
    expect(r.type).toBe("unknown_variant");
  });
});
