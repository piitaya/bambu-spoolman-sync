import { z } from "zod";
import type { AmsSlot, Spool } from "./spool.js";

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
 * Match a spool by variant_id against the community mapping.
 */
export function matchSpool(
  spool: Spool,
  mapping: Map<string, FilamentEntry>
): MatchResult {
  const hasInfo = !!spool.material || !!spool.variant_id || !!spool.product;
  if (!hasInfo) return { type: "unknown_spool" };
  if (!spool.variant_id) return { type: "third_party" };
  const entry = mapping.get(spool.variant_id);
  if (!entry) return { type: "unknown_variant" };
  if (!entry.spoolman_id) return { type: "known_unmapped", entry };
  return { type: "matched", entry };
}

/**
 * Match a slot. Empty/no-spool checks at the slot level, then
 * delegates to matchSpool.
 */
export function matchSlot(
  slot: AmsSlot,
  mapping: Map<string, FilamentEntry>
): MatchResult {
  if (!slot.has_spool) return { type: "empty" };
  if (!slot.spool) return { type: "unknown_spool" };
  return matchSpool(slot.spool, mapping);
}
