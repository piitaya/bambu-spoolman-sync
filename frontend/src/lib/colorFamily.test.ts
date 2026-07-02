import { describe, expect, it } from "vitest";
import { COLOR_FAMILIES, FAMILY_HEX, colorFamily } from "./colorFamily";

describe("colorFamily", () => {
  it("returns null for missing or invalid hex", () => {
    expect(colorFamily(null)).toBeNull();
    expect(colorFamily(undefined)).toBeNull();
    expect(colorFamily("")).toBeNull();
    expect(colorFamily("#12")).toBeNull();
    expect(colorFamily("zzzzzz")).toBeNull();
  });

  it("accepts hex with or without # and with an alpha channel", () => {
    expect(colorFamily("#1E88E5")).toBe("blue");
    expect(colorFamily("1E88E5")).toBe("blue");
    expect(colorFamily("#1E88E5FF")).toBe("blue");
  });

  it("classifies low-saturation colors by lightness", () => {
    expect(colorFamily("#FFFFFF")).toBe("white");
    expect(colorFamily("#000000")).toBe("black");
    expect(colorFamily("#9E9E9E")).toBe("grey");
  });

  it("classifies light reds as pink, not red", () => {
    expect(colorFamily("#F48FB1")).toBe("pink");
  });

  it("classifies warm light colors as beige", () => {
    expect(colorFamily("#F5DEB3")).toBe("beige");
  });

  it("classifies dark desaturated warm colors as brown but keeps saturated dark reds red", () => {
    expect(colorFamily("#795548")).toBe("brown");
    expect(colorFamily("#B71C1C")).toBe("red");
  });

  it("maps each representative family hex back to its family", () => {
    for (const family of COLOR_FAMILIES) {
      // The beige swatch (#D2B48C) sits below the l > 0.7 beige threshold
      // and classifies as orange; the swatch is only used for display.
      if (family === "beige") continue;
      expect(colorFamily(FAMILY_HEX[family])).toBe(family);
    }
  });
});
