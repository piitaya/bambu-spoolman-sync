export type ColorFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "white"
  | "black"
  | "grey";

export const COLOR_FAMILIES: readonly ColorFamily[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "white",
  "grey",
  "black",
];

// Representative hex for each family — used to render swatches in filter UIs.
export const FAMILY_HEX: Record<ColorFamily, string> = {
  red: "#E53935",
  orange: "#FB8C00",
  yellow: "#FDD835",
  green: "#43A047",
  blue: "#1E88E5",
  purple: "#8E24AA",
  pink: "#EC407A",
  brown: "#795548",
  white: "#FFFFFF",
  grey: "#9E9E9E",
  black: "#212121",
};

export function colorFamily(hex: string | null | undefined): ColorFamily | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);

  if (s < 0.12) {
    if (l > 0.85) return "white";
    if (l < 0.15) return "black";
    return "grey";
  }

  // Warm-low-lightness shades look brown to the eye even with some saturation.
  if (l < 0.35 && (h < 50 || h >= 345)) return "brown";

  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 65) return "yellow";
  if (h < 170) return "green";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

function parseHex(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "").trim();
  if (clean.length !== 6 && clean.length !== 8) return null;
  const n = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}
