import type { SpoolSavedView, SpoolSavedViewState } from "@pandaroo/shared";
import { describe, expect, it } from "vitest";
import {
  addSavedView,
  createSavedViewId,
  savedViewStatesEqual,
  removeSavedView,
  renameSavedView,
  updateSavedView,
} from "./savedViews";

function makeState(
  overrides: Partial<SpoolSavedViewState> = {},
): SpoolSavedViewState {
  return {
    materials: [],
    products: [],
    color_families: [],
    stock: "all",
    ams_only: false,
    no_remain: false,
    sort: { field: "product", direction: "asc" },
    group_by: "product",
    ...overrides,
  };
}

describe("savedViewStatesEqual", () => {
  it("matches identical states regardless of key order", () => {
    const a = makeState({ stock: "low" });
    const b = JSON.parse(JSON.stringify(a)) as Record<string, unknown>;
    const reordered = Object.fromEntries(Object.entries(b).reverse());
    expect(savedViewStatesEqual(a, reordered)).toBe(true);
  });

  it("distinguishes different states", () => {
    expect(savedViewStatesEqual(makeState({ stock: "low" }), makeState())).toBe(
      false,
    );
    expect(
      savedViewStatesEqual(makeState({ materials: ["PLA"] }), makeState()),
    ).toBe(false);
  });
});

describe("saved view list operations", () => {
  const base: SpoolSavedView[] = [
    { id: "a", name: "One", state: makeState({ stock: "low" }) },
    { id: "b", name: "Two", state: makeState({ materials: ["PLA"] }) },
  ];

  it("adds a view at the end", () => {
    const next = addSavedView(base, {
      id: "c",
      name: "Three",
      state: makeState(),
    });
    expect(next.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(base).toHaveLength(2);
  });

  it("updates name and state of the matching view", () => {
    const state = makeState({ stock: "full" });
    const next = updateSavedView(base, "a", "Updated", state);
    expect(next[0]).toEqual({ id: "a", name: "Updated", state });
    expect(next[1]).toEqual(base[1]);
  });

  it("renames only the matching view", () => {
    const next = renameSavedView(base, "a", "Renamed");
    expect(next[0].name).toBe("Renamed");
    expect(next[0].state).toEqual(base[0].state);
    expect(next[1].name).toBe("Two");
  });

  it("removes only the matching view", () => {
    const next = removeSavedView(base, "a");
    expect(next.map((p) => p.id)).toEqual(["b"]);
  });

  it("generates unique ids", () => {
    expect(createSavedViewId()).not.toBe(createSavedViewId());
  });
});
