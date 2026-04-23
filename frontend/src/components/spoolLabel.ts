/**
 * Normalizes a spool's color fields into a single array for the swatch.
 * Prefers the multi-color list when present, falls back to the single hex.
 */
export function spoolHexes(spool: {
  color_hex?: string | null;
  color_hexes?: string[] | null;
}): readonly string[] {
  if (spool.color_hexes && spool.color_hexes.length > 0) return spool.color_hexes;
  if (spool.color_hex) return [spool.color_hex];
  return [];
}

export interface SpoolLabels {
  primary: string;
  // "code" when `primary` is a variant id or tag id; "text" otherwise.
  primaryStyle: "text" | "code";
  secondary: string | null;
}

interface SpoolLike {
  color_name?: string | null;
  variant_id?: string | null;
  product?: string | null;
  material?: string | null;
  tag_id?: string | null;
}

// Primary picks the most specific identifier available; secondary adds context
// (product → material) but is dropped when it would repeat the primary.
export function spoolLabels(spool: SpoolLike): SpoolLabels {
  const color = spool.color_name?.trim() || null;
  const variant = spool.variant_id?.trim() || null;
  const product = spool.product?.trim() || null;
  const material = spool.material?.trim() || null;
  const tag = spool.tag_id?.trim() || null;

  const primary = color ?? variant ?? product ?? material ?? tag ?? "";
  const isCode = !color && (!!variant || (!product && !material && !!tag));
  const secondary = [product, material].find((c) => c != null && c !== primary) ?? null;

  return { primary, primaryStyle: isCode ? "code" : "text", secondary };
}
