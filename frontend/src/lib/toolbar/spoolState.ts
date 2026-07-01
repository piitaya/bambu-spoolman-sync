// Pure filter/sort/group state for the spool inventory toolbar:
// types, defaults, URL codec, and the filter/sort/group functions.

import { spoolHexes } from "../../components/spoolLabel";
import type { Spool } from "../../api";
import { COLOR_FAMILIES, colorFamily, type ColorFamily } from "../colorFamily";
import {
  applySort,
  deriveOptions,
  encodeSort,
  parseEnumParam,
  parseListParam,
  parseSortParam,
  parseViewParam,
  type SortState,
  type ToolbarView,
} from "./core";

export type SpoolStockLevel = "all" | "low" | "full";
const STOCK_LEVELS: readonly SpoolStockLevel[] = ["all", "low", "full"];

export type SpoolSortField =
  | "last_updated"
  | "last_used"
  | "first_seen"
  | "remain"
  | "remain_grams"
  | "material"
  | "product"
  | "color_name";

export type SpoolSort = SortState<SpoolSortField>;

export const DEFAULT_SORT: SpoolSort = { field: "product", direction: "asc" };

export type SpoolGroupBy = "none" | "material" | "product" | "color_family";
export const SPOOL_GROUP_VALUES: readonly SpoolGroupBy[] = [
  "none",
  "material",
  "product",
  "color_family",
];
export const DEFAULT_GROUP_BY: SpoolGroupBy = "product";

// Sensible defaults per field — newest-first for dates, lowest-first for
// "remaining" so low-stock rises to the top, alphabetical for text.
export const DEFAULT_DIRECTION: Record<SpoolSortField, "asc" | "desc"> = {
  last_updated: "desc",
  last_used: "desc",
  first_seen: "desc",
  remain: "asc",
  remain_grams: "asc",
  material: "asc",
  product: "asc",
  color_name: "asc",
};

export const SORT_FIELDS: readonly SpoolSortField[] = [
  "last_updated",
  "last_used",
  "first_seen",
  "remain",
  "remain_grams",
  "material",
  "product",
  "color_name",
];

export type SpoolView = ToolbarView;

export interface SpoolFilters {
  search: string;
  materials: string[];
  products: string[];
  colorFamilies: ColorFamily[];
  variantIds: string[];
  stock: SpoolStockLevel;
  amsOnly: boolean;
  noRemain: boolean;
}

export const EMPTY_FILTERS: SpoolFilters = {
  search: "",
  materials: [],
  products: [],
  colorFamilies: [],
  variantIds: [],
  stock: "all",
  amsOnly: false,
  noRemain: false,
};

export function spoolFacetsAreActive(f: SpoolFilters): boolean {
  return (
    f.materials.length > 0 ||
    f.products.length > 0 ||
    f.colorFamilies.length > 0 ||
    f.variantIds.length > 0 ||
    f.stock !== "all" ||
    f.amsOnly ||
    f.noRemain
  );
}

export function clearSpoolFacets(f: SpoolFilters): SpoolFilters {
  return {
    ...f,
    materials: [],
    products: [],
    colorFamilies: [],
    variantIds: [],
    stock: "all",
    amsOnly: false,
    noRemain: false,
  };
}

export function spoolFacetCount(filters: SpoolFilters): number {
  return (
    filters.materials.length +
    filters.products.length +
    filters.colorFamilies.length +
    (filters.variantIds.length > 0 ? 1 : 0) +
    (filters.stock !== "all" ? 1 : 0) +
    (filters.amsOnly ? 1 : 0) +
    (filters.noRemain ? 1 : 0)
  );
}

export const deriveSpoolOptions = deriveOptions;

export function remainingGrams(spool: Spool): number | null {
  if (spool.weight == null || spool.remain == null) return null;
  return (spool.weight * spool.remain) / 100;
}

function sortValue(
  spool: Spool,
  field: SpoolSortField,
): string | number | null {
  switch (field) {
    case "last_updated":
      return spool.last_updated;
    case "last_used":
      return spool.last_used;
    case "first_seen":
      return spool.first_seen;
    case "remain":
      return spool.remain ?? 0;
    case "remain_grams":
      return remainingGrams(spool) ?? 0;
    case "material":
      return spool.material;
    case "product":
      return spool.product;
    case "color_name":
      return spool.color_name;
  }
}

export function applySpoolSort(
  spools: readonly Spool[],
  sort: SpoolSort,
): Spool[] {
  return applySort(spools, sort, sortValue, [
    (s) => s.material,
    (s) => s.product,
    (s) => s.color_name,
  ]);
}

export function spoolStateToSearchParams(
  filters: SpoolFilters,
  sort: SpoolSort,
  view: SpoolView,
  groupBy: SpoolGroupBy,
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set("q", filters.search);
  if (filters.materials.length) p.set("material", filters.materials.join(","));
  if (filters.products.length) p.set("product", filters.products.join(","));
  if (filters.colorFamilies.length)
    p.set("color", filters.colorFamilies.join(","));
  if (filters.variantIds.length) p.set("variant", filters.variantIds.join(","));
  if (filters.stock !== "all") p.set("stock", filters.stock);
  if (filters.amsOnly) p.set("ams", "1");
  if (filters.noRemain) p.set("noremain", "1");
  encodeSort(p, sort, DEFAULT_SORT);
  if (view !== "table") p.set("view", view);
  if (groupBy !== DEFAULT_GROUP_BY) p.set("group", groupBy);
  return p;
}

export function searchParamsToSpoolState(params: URLSearchParams): {
  filters: SpoolFilters;
  sort: SpoolSort;
  view: SpoolView;
  groupBy: SpoolGroupBy;
} {
  const filters: SpoolFilters = {
    search: params.get("q") ?? "",
    materials: parseListParam(params.get("material")),
    products: parseListParam(params.get("product")),
    colorFamilies: parseListParam(params.get("color")).filter(
      (c): c is ColorFamily => COLOR_FAMILIES.includes(c as ColorFamily),
    ),
    variantIds: parseListParam(params.get("variant")),
    stock: parseEnumParam(params.get("stock"), STOCK_LEVELS, "all"),
    amsOnly: params.get("ams") === "1",
    noRemain: params.get("noremain") === "1",
  };
  const sort = parseSortParam(params.get("sort"), SORT_FIELDS, DEFAULT_SORT);
  const view = parseViewParam(params.get("view"));
  const groupBy = parseEnumParam(
    params.get("group"),
    SPOOL_GROUP_VALUES,
    DEFAULT_GROUP_BY,
  );
  return { filters, sort, view, groupBy };
}

export function applySpoolFilters(
  spools: readonly Spool[],
  filters: SpoolFilters,
  loadedTags: ReadonlySet<string>,
): Spool[] {
  const q = filters.search.trim().toLowerCase();
  const materialSet = new Set(filters.materials);
  const productSet = new Set(filters.products);
  const familySet = new Set(filters.colorFamilies);
  const variantSet = new Set(filters.variantIds);
  const out: Spool[] = [];
  for (const s of spools) {
    if (variantSet.size > 0 && (!s.variant_id || !variantSet.has(s.variant_id)))
      continue;
    if (q) {
      const hay = [s.color_name, s.product, s.material, s.variant_id]
        .filter((v): v is string => !!v)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (materialSet.size > 0 && (!s.material || !materialSet.has(s.material)))
      continue;
    if (productSet.size > 0 && (!s.product || !productSet.has(s.product)))
      continue;
    if (familySet.size > 0) {
      let matched = false;
      for (const h of spoolHexes(s)) {
        const fam = colorFamily(h);
        if (fam && familySet.has(fam)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
    }
    switch (filters.stock) {
      case "low":
        if (s.remain == null || s.remain >= 20) continue;
        break;
      case "full":
        if (s.remain == null || s.remain < 95) continue;
        break;
    }
    if (filters.amsOnly && !loadedTags.has(s.tag_id)) continue;
    if (filters.noRemain && s.remain != null) continue;
    out.push(s);
  }
  return out;
}

export function getSpoolGroupKey(spool: Spool, groupBy: SpoolGroupBy): string {
  switch (groupBy) {
    case "material":
      return spool.material ?? "";
    case "product":
      return spool.product ?? "";
    case "color_family": {
      for (const h of spoolHexes(spool)) {
        const fam = colorFamily(h);
        if (fam) return fam;
      }
      return "";
    }
    case "none":
      return "";
  }
}

export function getSpoolGroupLabel(
  key: string,
  groupBy: SpoolGroupBy,
  t: (k: string) => string,
): string {
  if (groupBy === "color_family") return t(`color_family.${key}`);
  return key;
}
