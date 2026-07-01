import { describe, expect, it } from "vitest";
import type { Spool } from "../../api";
import {
  applySpoolFilters,
  applySpoolSort,
  DEFAULT_GROUP_BY,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  searchParamsToSpoolState,
  spoolStateToSearchParams,
} from "./spoolState";

function makeSpool(overrides: Partial<Spool> = {}): Spool {
  return {
    tag_id: "tag",
    variant_id: null,
    match_type: "third_party",
    material: null,
    product: null,
    color_hex: null,
    color_hexes: null,
    color_name: null,
    weight: 1000,
    remain: null,
    temp_min: null,
    temp_max: null,
    last_used: null,
    first_seen: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const NO_TAGS: ReadonlySet<string> = new Set();

describe("applySpoolFilters", () => {
  it("treats remain < 20 as low stock and >= 95 as full", () => {
    const low = makeSpool({ tag_id: "low", remain: 19 });
    const boundary = makeSpool({ tag_id: "boundary", remain: 20 });
    const almostFull = makeSpool({ tag_id: "almost", remain: 94 });
    const full = makeSpool({ tag_id: "full", remain: 95 });
    const unknown = makeSpool({ tag_id: "unknown", remain: null });
    const spools = [low, boundary, almostFull, full, unknown];

    const lowResult = applySpoolFilters(
      spools,
      { ...EMPTY_FILTERS, stock: "low" },
      NO_TAGS,
    );
    expect(lowResult.map((s) => s.tag_id)).toEqual(["low"]);

    const fullResult = applySpoolFilters(
      spools,
      { ...EMPTY_FILTERS, stock: "full" },
      NO_TAGS,
    );
    expect(fullResult.map((s) => s.tag_id)).toEqual(["full"]);
  });

  it("filters by material and searches across text fields", () => {
    const pla = makeSpool({ tag_id: "a", material: "PLA", product: "Basic" });
    const petg = makeSpool({ tag_id: "b", material: "PETG", product: "HF" });
    const spools = [pla, petg];

    expect(
      applySpoolFilters(
        spools,
        { ...EMPTY_FILTERS, materials: ["PLA"] },
        NO_TAGS,
      ).map((s) => s.tag_id),
    ).toEqual(["a"]);

    expect(
      applySpoolFilters(
        spools,
        { ...EMPTY_FILTERS, search: "hf" },
        NO_TAGS,
      ).map((s) => s.tag_id),
    ).toEqual(["b"]);
  });

  it("restricts to loaded tags with amsOnly and to unknown remain with noRemain", () => {
    const loaded = makeSpool({ tag_id: "loaded", remain: 50 });
    const shelf = makeSpool({ tag_id: "shelf", remain: null });
    const spools = [loaded, shelf];

    expect(
      applySpoolFilters(
        spools,
        { ...EMPTY_FILTERS, amsOnly: true },
        new Set(["loaded"]),
      ).map((s) => s.tag_id),
    ).toEqual(["loaded"]);

    expect(
      applySpoolFilters(
        spools,
        { ...EMPTY_FILTERS, noRemain: true },
        NO_TAGS,
      ).map((s) => s.tag_id),
    ).toEqual(["shelf"]);
  });
});

describe("applySpoolSort", () => {
  it("sorts by the primary field with nulls last and stable tiebreakers", () => {
    const a = makeSpool({ tag_id: "a", remain: 10, material: "PLA" });
    const b = makeSpool({ tag_id: "b", remain: 80, material: "ABS" });
    const c = makeSpool({ tag_id: "c", remain: 10, material: "ABS" });
    const sorted = applySpoolSort([a, b, c], {
      field: "remain",
      direction: "asc",
    });
    expect(sorted.map((s) => s.tag_id)).toEqual(["c", "a", "b"]);
  });
});

describe("spool state URL codec", () => {
  it("round-trips a fully populated state", () => {
    const filters = {
      search: "matte",
      materials: ["PLA"],
      products: ["PLA Matte"],
      colorFamilies: ["red" as const],
      variantIds: ["GFA00"],
      stock: "low" as const,
      amsOnly: true,
      noRemain: false,
    };
    const sort = { field: "remain" as const, direction: "asc" as const };
    const params = spoolStateToSearchParams(filters, sort, "grid", "material");
    const state = searchParamsToSpoolState(params);
    expect(state.filters).toEqual(filters);
    expect(state.sort).toEqual(sort);
    expect(state.view).toBe("grid");
    expect(state.groupBy).toBe("material");
  });

  it("produces no params for the default state", () => {
    const params = spoolStateToSearchParams(
      EMPTY_FILTERS,
      DEFAULT_SORT,
      "table",
      DEFAULT_GROUP_BY,
    );
    expect(params.toString()).toBe("");
  });

  it("falls back to defaults on invalid params", () => {
    const state = searchParamsToSpoolState(
      new URLSearchParams(
        "stock=bogus&sort=nope:asc&view=nope&group=nope&color=neon",
      ),
    );
    expect(state.filters.stock).toBe("all");
    expect(state.filters.colorFamilies).toEqual([]);
    expect(state.sort).toEqual(DEFAULT_SORT);
    expect(state.view).toBe("table");
    expect(state.groupBy).toBe(DEFAULT_GROUP_BY);
  });
});
