import { describe, expect, it } from "vitest";
import type { CatalogEntry, Spool } from "../../api";
import {
  aggregateBySku,
  applyFilamentFilters,
  DEFAULT_GROUP_BY,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filamentStateToSearchParams,
  searchParamsToFilamentState,
} from "./filamentState";

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: "GFA00-K0",
    sku: "10101",
    material: "PLA",
    product: "PLA Basic",
    color_name: "Black",
    color_hex: "#000000",
    color_hexes: [],
    weight: 1000,
    temp_min: 190,
    temp_max: 230,
    integrations: {},
    ...overrides,
  };
}

function makeSpool(overrides: Partial<Spool> = {}): Spool {
  return {
    tag_id: "tag",
    variant_id: "GFA00-K0",
    match_type: "known",
    material: "PLA",
    product: "PLA Basic",
    color_hex: "#000000",
    color_hexes: null,
    color_name: "Black",
    weight: 1000,
    remain: 50,
    temp_min: null,
    temp_max: null,
    last_used: null,
    first_seen: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateBySku", () => {
  it("groups catalog variants by sku+product and attaches owned spools", () => {
    const black = makeEntry({ id: "GFA00-K0" });
    const blackRefill = makeEntry({ id: "GFA00-K0-R" });
    const white = makeEntry({
      id: "GFA00-W0",
      sku: "10102",
      color_name: "White",
    });
    const owned = makeSpool({ tag_id: "t1", variant_id: "GFA00-K0" });
    const ownedRefill = makeSpool({
      tag_id: "t2",
      variant_id: "GFA00-K0-R",
      remain: 30,
    });

    const rows = aggregateBySku(
      [black, blackRefill, white],
      [owned, ownedRefill],
    );
    expect(rows).toHaveLength(2);

    const blackRow = rows.find((r) => r.entry.id === "GFA00-K0")!;
    expect(blackRow.variantIds).toEqual(["GFA00-K0", "GFA00-K0-R"]);
    expect(blackRow.ownership?.spools.map((s) => s.tag_id)).toEqual([
      "t1",
      "t2",
    ]);
    // 50% + 30% of 1000 g
    expect(blackRow.ownership?.totalRemaining).toBe(800);

    const whiteRow = rows.find((r) => r.entry.id === "GFA00-W0")!;
    expect(whiteRow.ownership).toBeNull();
  });

  it("ignores spools without a variant id", () => {
    const rows = aggregateBySku(
      [makeEntry()],
      [makeSpool({ variant_id: null })],
    );
    expect(rows[0].ownership).toBeNull();
  });
});

describe("applyFilamentFilters", () => {
  it("filters by ownership", () => {
    const rows = aggregateBySku(
      [makeEntry(), makeEntry({ id: "GFA00-W0", sku: "10102" })],
      [makeSpool()],
    );

    expect(
      applyFilamentFilters(rows, {
        ...EMPTY_FILTERS,
        ownership: "owned",
      }).map((r) => r.entry.id),
    ).toEqual(["GFA00-K0"]);

    expect(
      applyFilamentFilters(rows, {
        ...EMPTY_FILTERS,
        ownership: "not_owned",
      }).map((r) => r.entry.id),
    ).toEqual(["GFA00-W0"]);
  });

  it("searches across sku and variant ids", () => {
    const rows = aggregateBySku([makeEntry()], []);
    expect(
      applyFilamentFilters(rows, { ...EMPTY_FILTERS, search: "gfa00" }),
    ).toHaveLength(1);
    expect(
      applyFilamentFilters(rows, { ...EMPTY_FILTERS, search: "nope" }),
    ).toHaveLength(0);
  });
});

describe("filament state URL codec", () => {
  it("round-trips a fully populated state", () => {
    const filters = {
      search: "basic",
      materials: ["PLA"],
      products: ["PLA Basic"],
      colorFamilies: ["black" as const],
      ownership: "owned" as const,
    };
    const sort = { field: "remain_grams" as const, direction: "desc" as const };
    const params = filamentStateToSearchParams(filters, sort, "list", "owned");
    const state = searchParamsToFilamentState(params);
    expect(state.filters).toEqual(filters);
    expect(state.sort).toEqual(sort);
    expect(state.view).toBe("list");
    expect(state.groupBy).toBe("owned");
  });

  it("falls back to defaults on invalid params", () => {
    const state = searchParamsToFilamentState(
      new URLSearchParams("own=bogus&sort=remain_grams:sideways&group=nope"),
    );
    expect(state.filters.ownership).toBe("all");
    expect(state.sort).toEqual(DEFAULT_SORT);
    expect(state.groupBy).toBe(DEFAULT_GROUP_BY);
  });
});
