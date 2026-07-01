// Pure filter/sort/group state for the filament catalog toolbar:
// types, defaults, URL codec, aggregation, and filter/sort/group functions.

import { spoolHexes } from "../../components/spoolLabel";
import type { CatalogEntry, Spool } from "../../api";
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

export interface FilamentOwnership {
  spools: Spool[];
  totalRemaining: number | null;
}

export interface FilamentRow {
  entry: CatalogEntry;
  variantIds: string[];
  ownership: FilamentOwnership | null;
}

export function aggregateBySku(
  catalog: readonly CatalogEntry[],
  spools: readonly Spool[],
): FilamentRow[] {
  const spoolsByVariant = new Map<string, Spool[]>();
  for (const s of spools) {
    if (!s.variant_id) continue;
    const arr = spoolsByVariant.get(s.variant_id);
    if (arr) arr.push(s);
    else spoolsByVariant.set(s.variant_id, [s]);
  }
  const groups = new Map<string, CatalogEntry[]>();
  for (const e of catalog) {
    const key = `${e.sku}::${e.product}`;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }
  const rows: FilamentRow[] = [];
  for (const entries of groups.values()) {
    const entry = entries[0];
    const variantIds = entries.map((e) => e.id);
    const owned: Spool[] = [];
    for (const id of variantIds) {
      const sp = spoolsByVariant.get(id);
      if (sp) owned.push(...sp);
    }
    let total: number | null = null;
    for (const s of owned) {
      if (s.weight != null && s.remain != null) {
        total = (total ?? 0) + (s.weight * s.remain) / 100;
      }
    }
    const ownership: FilamentOwnership | null =
      owned.length > 0 ? { spools: owned, totalRemaining: total } : null;
    rows.push({ entry, variantIds, ownership });
  }
  return rows;
}

export type FilamentOwnershipFilter = "all" | "owned" | "not_owned";
const OWNERSHIP_VALUES: readonly FilamentOwnershipFilter[] = [
  "all",
  "owned",
  "not_owned",
];

export type FilamentSortField =
  "material" | "product" | "color_name" | "owned" | "remain_grams";

export type FilamentSort = SortState<FilamentSortField>;

export const DEFAULT_SORT: FilamentSort = {
  field: "product",
  direction: "asc",
};

export type FilamentGroupBy =
  "none" | "material" | "product" | "color_family" | "owned";
export const FILAMENT_GROUP_VALUES: readonly FilamentGroupBy[] = [
  "none",
  "material",
  "product",
  "color_family",
  "owned",
];
export const DEFAULT_GROUP_BY: FilamentGroupBy = "product";

export const DEFAULT_DIRECTION: Record<FilamentSortField, "asc" | "desc"> = {
  material: "asc",
  product: "asc",
  color_name: "asc",
  owned: "desc",
  remain_grams: "desc",
};

export const SORT_FIELDS: readonly FilamentSortField[] = [
  "material",
  "product",
  "color_name",
  "owned",
  "remain_grams",
];

export type FilamentView = ToolbarView;

export interface FilamentFilters {
  search: string;
  materials: string[];
  products: string[];
  colorFamilies: ColorFamily[];
  ownership: FilamentOwnershipFilter;
}

export const EMPTY_FILTERS: FilamentFilters = {
  search: "",
  materials: [],
  products: [],
  colorFamilies: [],
  ownership: "all",
};

export function filamentFacetsAreActive(f: FilamentFilters): boolean {
  return (
    f.materials.length > 0 ||
    f.products.length > 0 ||
    f.colorFamilies.length > 0 ||
    f.ownership !== "all"
  );
}

export function clearFilamentFacets(f: FilamentFilters): FilamentFilters {
  return {
    ...f,
    materials: [],
    products: [],
    colorFamilies: [],
    ownership: "all",
  };
}

export function filamentFacetCount(filters: FilamentFilters): number {
  return (
    filters.materials.length +
    filters.products.length +
    filters.colorFamilies.length +
    (filters.ownership !== "all" ? 1 : 0)
  );
}

export const deriveFilamentOptions = deriveOptions;

function primaryValue(
  row: FilamentRow,
  field: FilamentSortField,
): string | number | null {
  switch (field) {
    case "material":
      return row.entry.material;
    case "product":
      return row.entry.product;
    case "color_name":
      return row.entry.color_name;
    case "owned":
      return row.ownership ? 1 : 0;
    case "remain_grams":
      return row.ownership?.totalRemaining ?? 0;
  }
}

export function applyFilamentSort(
  rows: readonly FilamentRow[],
  sort: FilamentSort,
): FilamentRow[] {
  return applySort(rows, sort, primaryValue, [
    (r) => r.entry.material,
    (r) => r.entry.product,
    (r) => r.entry.color_name,
  ]);
}

export function filamentStateToSearchParams(
  filters: FilamentFilters,
  sort: FilamentSort,
  view: FilamentView,
  groupBy: FilamentGroupBy,
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set("q", filters.search);
  if (filters.materials.length) p.set("material", filters.materials.join(","));
  if (filters.products.length) p.set("product", filters.products.join(","));
  if (filters.colorFamilies.length)
    p.set("color", filters.colorFamilies.join(","));
  if (filters.ownership !== "all") p.set("own", filters.ownership);
  encodeSort(p, sort, DEFAULT_SORT);
  if (view !== "table") p.set("view", view);
  if (groupBy !== DEFAULT_GROUP_BY) p.set("group", groupBy);
  return p;
}

export function searchParamsToFilamentState(params: URLSearchParams): {
  filters: FilamentFilters;
  sort: FilamentSort;
  view: FilamentView;
  groupBy: FilamentGroupBy;
} {
  const filters: FilamentFilters = {
    search: params.get("q") ?? "",
    materials: parseListParam(params.get("material")),
    products: parseListParam(params.get("product")),
    colorFamilies: parseListParam(params.get("color")).filter(
      (c): c is ColorFamily => COLOR_FAMILIES.includes(c as ColorFamily),
    ),
    ownership: parseEnumParam(params.get("own"), OWNERSHIP_VALUES, "all"),
  };
  const sort = parseSortParam(params.get("sort"), SORT_FIELDS, DEFAULT_SORT);
  const view = parseViewParam(params.get("view"));
  const groupBy = parseEnumParam(
    params.get("group"),
    FILAMENT_GROUP_VALUES,
    DEFAULT_GROUP_BY,
  );
  return { filters, sort, view, groupBy };
}

export function applyFilamentFilters(
  rows: readonly FilamentRow[],
  filters: FilamentFilters,
): FilamentRow[] {
  const q = filters.search.trim().toLowerCase();
  const materialSet = new Set(filters.materials);
  const productSet = new Set(filters.products);
  const familySet = new Set(filters.colorFamilies);
  const out: FilamentRow[] = [];
  for (const row of rows) {
    const e = row.entry;
    if (q) {
      const hay = [
        e.color_name,
        e.product,
        e.material,
        e.sku,
        ...row.variantIds,
      ]
        .filter((v): v is string => !!v)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (materialSet.size > 0 && (!e.material || !materialSet.has(e.material)))
      continue;
    if (productSet.size > 0 && !productSet.has(e.product)) continue;
    if (familySet.size > 0) {
      let matched = false;
      for (const h of spoolHexes(e)) {
        const fam = colorFamily(h);
        if (fam && familySet.has(fam)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
    }
    if (filters.ownership === "owned" && !row.ownership) continue;
    if (filters.ownership === "not_owned" && row.ownership) continue;
    out.push(row);
  }
  return out;
}

export function getFilamentGroupKey(
  row: FilamentRow,
  groupBy: FilamentGroupBy,
): string {
  switch (groupBy) {
    case "material":
      return row.entry.material ?? "";
    case "product":
      return row.entry.product;
    case "color_family": {
      for (const h of spoolHexes(row.entry)) {
        const fam = colorFamily(h);
        if (fam) return fam;
      }
      return "";
    }
    case "owned":
      return row.ownership ? "owned" : "not_owned";
    case "none":
      return "";
  }
}

export function getFilamentGroupLabel(
  key: string,
  groupBy: FilamentGroupBy,
  t: (k: string) => string,
): string {
  if (groupBy === "color_family") return t(`color_family.${key}`);
  if (groupBy === "owned") return t(`filaments.ownership.${key}`);
  return key;
}
