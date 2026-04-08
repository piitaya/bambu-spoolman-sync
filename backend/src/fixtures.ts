import type { AMSSlot, FilamentEntry, MatchType } from "./matcher.js";

/**
 * Dev-only fixture printer used to preview every dashboard slot
 * rendering without touching a real printer. Activated by setting
 * `FIXTURES=1` in the backend env.
 *
 * Match types are short-circuited (not run through `matchSlot`) so
 * each scenario is forced regardless of what's in the cached mapping.
 *
 * Layout:
 *   Right nozzle (AMS A): mapped × 4 in different fill states
 *   Right nozzle (AMS B): every non-matched edge case
 *   Left nozzle  (AMS HT): one mapped HT slot
 */

interface FixtureSlot {
  slot: AMSSlot;
  type: MatchType;
  entry?: FilamentEntry;
}

const slot = (
  over: Partial<AMSSlot> & {
    ams_id: number;
    slot_id: number;
  }
): AMSSlot => ({
  printer_serial: "FIXTURE",
  nozzle_id: null,
  tray_id_name: null,
  tray_sub_brands: null,
  tray_type: null,
  tray_color: null,
  tray_uuid: null,
  nozzle_temp_min: null,
  nozzle_temp_max: null,
  tray_weight: null,
  remain: null,
  ...over
});

export function buildFixturePrinter() {
  const slots: FixtureSlot[] = [
    // ---- Right nozzle, AMS A — every "matched" fill state ----
    {
      slot: slot({
        ams_id: 0,
        nozzle_id: 0,
        slot_id: 0,
        tray_id_name: "A00-A0",
        tray_sub_brands: "PLA Basic",
        tray_type: "PLA",
        tray_color: "FF6A00FF",
        tray_uuid: "FIXTURE-MATCHED-FULL",
        nozzle_temp_min: 190,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 100
      }),
      type: "matched",
      entry: {
        id: "A00-A0",
        material: "PLA Basic",
        color_name: "Orange",
        color_hex: "FF6A00",
        spoolman_id: "bambulab_pla_basic_orange_1000_175_n"
      }
    },
    {
      slot: slot({
        ams_id: 0,
        nozzle_id: 0,
        slot_id: 1,
        tray_id_name: "A00-T0",
        tray_sub_brands: "PLA Basic",
        tray_type: "PLA",
        tray_color: "1ABC9CFF",
        tray_uuid: "FIXTURE-MATCHED-MID",
        nozzle_temp_min: 190,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 64
      }),
      type: "matched",
      entry: {
        id: "A00-T0",
        material: "PLA Basic",
        color_name: "Turquoise",
        color_hex: "1ABC9C",
        spoolman_id: "bambulab_pla_basic_turquoise_1000_175_n"
      }
    },
    {
      slot: slot({
        ams_id: 0,
        nozzle_id: 0,
        slot_id: 2,
        tray_id_name: "A01-Y2",
        tray_sub_brands: "PLA Matte",
        tray_type: "PLA",
        tray_color: "F7D959FF",
        tray_uuid: "FIXTURE-MATCHED-LOW",
        nozzle_temp_min: 190,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 23
      }),
      type: "matched",
      entry: {
        id: "A01-Y2",
        material: "PLA Matte",
        color_name: "Lemon Yellow",
        color_hex: "F7D959",
        spoolman_id: "bambulab_pla_matte_lemonyellow_1000_175_n"
      }
    },
    {
      slot: slot({
        ams_id: 0,
        nozzle_id: 0,
        slot_id: 3,
        tray_id_name: "A01-K1",
        tray_sub_brands: "PLA Matte",
        tray_type: "PLA",
        tray_color: "000000FF",
        tray_uuid: "FIXTURE-MATCHED-CRIT",
        nozzle_temp_min: 190,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 7
      }),
      type: "matched",
      entry: {
        id: "A01-K1",
        material: "PLA Matte",
        color_name: "Charcoal",
        color_hex: "000000",
        spoolman_id: "bambulab_pla_matte_charcoal_1000_175_n"
      }
    },

    // ---- Right nozzle, AMS B — non-matched edge cases ----
    {
      slot: slot({
        ams_id: 1,
        nozzle_id: 0,
        slot_id: 0,
        tray_id_name: "X99-Z9",
        tray_sub_brands: "PLA Galaxy",
        tray_type: "PLA",
        tray_color: "5C3E99FF",
        tray_uuid: "FIXTURE-KNOWN",
        nozzle_temp_min: 210,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 88
      }),
      type: "known_unmapped",
      entry: {
        id: "X99-Z9",
        material: "PLA Galaxy",
        color_name: "Galaxy Purple",
        color_hex: "5C3E99",
        spoolman_id: null
      }
    },
    {
      slot: slot({
        ams_id: 1,
        nozzle_id: 0,
        slot_id: 1,
        tray_id_name: "ZZ-99",
        tray_sub_brands: "PLA Mystery",
        tray_type: "PLA",
        tray_color: "FFFFFFFF",
        tray_uuid: "FIXTURE-UNKNOWN",
        nozzle_temp_min: 210,
        nozzle_temp_max: 230,
        tray_weight: "1000",
        remain: 41
      }),
      type: "unknown_variant"
    },
    // Third party where the user filled in type + color on the
    // printer touchscreen. No RFID = no weight, no remain — even
    // when the printer "thinks" it knows them, those fields are
    // never reported for non-Bambu spools.
    {
      slot: slot({
        ams_id: 1,
        nozzle_id: 0,
        slot_id: 2,
        tray_sub_brands: "Generic PETG",
        tray_type: "PETG",
        tray_color: "FF3366FF",
        nozzle_temp_min: 230,
        nozzle_temp_max: 250
      }),
      type: "third_party"
    },
    // Empty slot — nothing loaded at all.
    {
      slot: slot({
        ams_id: 1,
        nozzle_id: 0,
        slot_id: 3
      }),
      type: "empty"
    },

    // ---- Left nozzle, AMS HT — one mapped HT slot ----
    {
      slot: slot({
        ams_id: 128,
        nozzle_id: 1,
        slot_id: 0,
        tray_id_name: "A02-W0",
        tray_sub_brands: "PETG HF",
        tray_type: "PETG",
        tray_color: "FFFFFFFF",
        tray_uuid: "FIXTURE-HT",
        nozzle_temp_min: 240,
        nozzle_temp_max: 260,
        tray_weight: "1000",
        remain: 76
      }),
      type: "matched",
      entry: {
        id: "A02-W0",
        material: "PETG HF",
        color_name: "Cotton White",
        color_hex: "FFFFFF",
        spoolman_id: "bambulab_petg_hf_cottonwhite_1000_175_n"
      }
    }
  ];

  return {
    serial: "FIXTURE",
    name: "Fixtures (dev)",
    enabled: true,
    status: { lastError: null, errorCode: null },
    slots
  };
}
