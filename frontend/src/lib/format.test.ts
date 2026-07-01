import { describe, expect, it } from "vitest";
import { formatGrams } from "./format";

describe("formatGrams", () => {
  it("returns a dash for null", () => {
    expect(formatGrams(null)).toBe("—");
  });

  it("rounds grams below 1000", () => {
    expect(formatGrams(0)).toBe("0 g");
    expect(formatGrams(999.4)).toBe("999 g");
  });

  it("switches to kilograms with two decimals at 1000", () => {
    expect(formatGrams(1000)).toBe("1.00 kg");
    expect(formatGrams(1250)).toBe("1.25 kg");
  });
});
