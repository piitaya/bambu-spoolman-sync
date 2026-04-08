import { z } from "zod";

export const FilamentEntrySchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  material: z.string().optional(),
  color_name: z.string().optional(),
  color_hex: z.string().optional(),
  spoolman_id: z.string().optional().nullable()
});
export type FilamentEntry = z.infer<typeof FilamentEntrySchema>;

export const FilamentsFileSchema = z.array(FilamentEntrySchema);

export interface AMSSlot {
  printer_serial: string;
  ams_id: number;
  /**
   * Extruder assignment, decoded from the AMS `info` hex field's bits
   * 8–11 (BambuStudio's `DevFilaSystem.cpp` convention).
   *   0 → right / main nozzle
   *   1 → left / deputy nozzle
   *   null → single-nozzle printer or uninitialized (0xE)
   */
  nozzle_id: number | null;
  slot_id: number;
  tray_id_name: string | null;
  tray_sub_brands: string | null;
  tray_type: string | null;
  tray_color: string | null;
  tray_colors: string[] | null;
  tray_uuid: string | null;
  nozzle_temp_min: number | null;
  nozzle_temp_max: number | null;
  tray_weight: string | null;
  remain: number | null;
  /**
   * True when the AMS-level `tray_exist_bits` bitfield reports this
   * slot as physically occupied. Lets us distinguish a truly empty
   * slot from a loaded slot whose RFID couldn't be read.
   */
  present: boolean;
}

export type MatchType =
  | "matched"
  | "known_unmapped"
  | "unknown_variant"
  | "third_party"
  | "unknown_spool"
  | "empty";

export interface MatchResult {
  type: MatchType;
  entry?: FilamentEntry;
}

/**
 * Deterministic match by `tray_id_name` (the Bambu RFID variant id).
 * No fuzzy matching, no string transforms, no color comparisons —
 * either the variant is in the mapping or it isn't.
 */
export function matchSlot(
  slot: AMSSlot,
  mapping: Map<string, FilamentEntry>
): MatchResult {
  // Physical presence comes from the AMS `tray_exist_bits` bitfield.
  // If the slot isn't reported as occupied, it's genuinely empty —
  // regardless of leftover tray fields.
  if (!slot.present) return { type: "empty" };

  const hasTrayInfo =
    !!slot.tray_type || !!slot.tray_id_name || !!slot.tray_sub_brands;
  // Tray physically present but the printer has no information at
  // all about it (RFID unread, no reported material). Different from
  // a third-party spool, which at least reports a material.
  if (!hasTrayInfo) return { type: "unknown_spool" };

  if (!slot.tray_id_name) return { type: "third_party" };
  const entry = mapping.get(slot.tray_id_name);
  if (!entry) return { type: "unknown_variant" };
  if (!entry.spoolman_id) return { type: "known_unmapped", entry };
  return { type: "matched", entry };
}
