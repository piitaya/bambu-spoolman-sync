import { describe, expect, it } from "vitest";
import { groupRows } from "./groupRows";

interface Row {
  id: number;
  material: string;
}

describe("groupRows", () => {
  const rows: Row[] = [
    { id: 1, material: "PLA" },
    { id: 2, material: "PETG" },
    { id: 3, material: "PLA" },
    { id: 4, material: "" },
  ];

  it("groups rows by key preserving first-seen order", () => {
    const groups = groupRows(rows, (r) => r.material);
    expect(groups.map((g) => g.key)).toEqual(["PLA", "PETG", "__empty__"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it("pushes the empty-key group last with a dash label", () => {
    const groups = groupRows(rows, (r) => r.material);
    const last = groups[groups.length - 1];
    expect(last.label).toBe("—");
    expect(last.rows.map((r) => r.id)).toEqual([4]);
  });

  it("applies the label function to non-empty keys only", () => {
    const groups = groupRows(
      rows,
      (r) => r.material,
      (k) => k.toLowerCase(),
    );
    expect(groups.map((g) => g.label)).toEqual(["pla", "petg", "—"]);
  });

  it("returns an empty array for no rows", () => {
    expect(groupRows([], () => "x")).toEqual([]);
  });
});
