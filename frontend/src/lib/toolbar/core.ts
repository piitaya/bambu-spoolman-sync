// Pure, domain-agnostic helpers shared by the spool and filament toolbars.

import { spoolHexes } from "../../components/spoolLabel";
import { COLOR_FAMILIES, colorFamily, type ColorFamily } from "../colorFamily";

export type SortDirection = "asc" | "desc";

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * Sort a copy of `items` by the sort field's primary value, falling back
 * to the given tiebreakers (always ascending) for equal primaries.
 */
export function applySort<T, F extends string>(
  items: readonly T[],
  sort: SortState<F>,
  primaryValue: (item: T, field: F) => string | number | null,
  tiebreakers: ReadonlyArray<(item: T) => string | number | null | undefined>,
): T[] {
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const primary =
      compareValues(primaryValue(a, sort.field), primaryValue(b, sort.field)) *
      dir;
    if (primary !== 0) return primary;
    for (const tiebreaker of tiebreakers) {
      const result = compareValues(tiebreaker(a), tiebreaker(b));
      if (result !== 0) return result;
    }
    return 0;
  });
}

export function parseEnumParam<T extends string>(
  raw: string | null,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

export function parseListParam(raw: string | null): string[] {
  return raw?.split(",").filter(Boolean) ?? [];
}

export function parseSortParam<F extends string>(
  raw: string | null,
  fields: readonly F[],
  fallback: SortState<F>,
): SortState<F> {
  if (!raw) return fallback;
  const [field, direction] = raw.split(":");
  if (
    fields.includes(field as F) &&
    (direction === "asc" || direction === "desc")
  ) {
    return { field: field as F, direction };
  }
  return fallback;
}

export function encodeSort<F extends string>(
  params: URLSearchParams,
  sort: SortState<F>,
  defaultSort: SortState<F>,
): void {
  if (
    sort.field !== defaultSort.field ||
    sort.direction !== defaultSort.direction
  ) {
    params.set("sort", `${sort.field}:${sort.direction}`);
  }
}

export type ToolbarView = "table" | "grid" | "list";

export function parseViewParam(raw: string | null): ToolbarView {
  return raw === "grid" || raw === "list" ? raw : "table";
}

export interface FacetOptions {
  materials: string[];
  products: string[];
  colorFamilies: ColorFamily[];
}

export interface FacetItem {
  material: string | null;
  product: string | null;
  color_hex?: string | null;
  color_hexes?: string[] | null;
}

/**
 * Derive the available material / product / color-family facet options
 * from the item list. When materials are selected, products and color
 * families cascade: only options present on matching items are offered.
 */
export function deriveOptions(
  items: readonly FacetItem[],
  selectedMaterials: readonly string[] = [],
): FacetOptions {
  const materials = new Set<string>();
  const products = new Set<string>();
  const families = new Set<ColorFamily>();
  const materialFilter = new Set(selectedMaterials);
  const cascadeActive = materialFilter.size > 0;
  for (const item of items) {
    if (item.material) materials.add(item.material);
    if (cascadeActive && (!item.material || !materialFilter.has(item.material)))
      continue;
    if (item.product) products.add(item.product);
    for (const h of spoolHexes(item)) {
      const fam = colorFamily(h);
      if (fam) families.add(fam);
    }
  }
  return {
    materials: [...materials].sort(),
    products: [...products].sort(),
    colorFamilies: COLOR_FAMILIES.filter((f) => families.has(f)),
  };
}
