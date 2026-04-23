// Bambu reports `"00000000"` (all zeros, including alpha) when a tray
// has no known color. Any other value is a real color — including
// `"000000FF"` (opaque black) and `"FFFFFFFF"` (opaque white), which
// are valid filament colors we must render as-is.
export function swatchFill(hex: string | null | undefined): string | null {
  if (!hex || hex === "00000000") return null;
  return `#${hex.slice(0, 6)}`;
}

/**
 * Returns a CSS `background` value for a filament's color(s): a single color
 * string when there's one hex, a hard-stop horizontal linear gradient when
 * there are multiple (e.g. bicolor PLA). Returns null when no valid colors.
 */
export function swatchBackground(
  hexes: ReadonlyArray<string | null | undefined>,
): string | null {
  const colors = hexes
    .map(swatchFill)
    .filter((c): c is string => c !== null);
  if (colors.length === 0) return null;
  if (colors.length === 1) return colors[0];
  const stops: string[] = [];
  colors.forEach((c, i) => {
    const start = (i / colors.length) * 100;
    const end = ((i + 1) / colors.length) * 100;
    stops.push(`${c} ${start}%`, `${c} ${end}%`);
  });
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

interface Props {
  hex?: string | null;
  hexes?: ReadonlyArray<string | null | undefined>;
  size?: number;
  /** Render as a circle instead of a rounded square. */
  round?: boolean;
}

export function ColorSwatch({ hex, hexes, size = 20, round = false }: Props) {
  const source = hexes && hexes.length > 0 ? hexes : hex != null ? [hex] : [];
  const background = swatchBackground(source);

  const borderRadius = round ? "50%" : size >= 32 ? 6 : 4;
  const common = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
  } as const;

  if (!background) {
    return (
      <div
        style={{
          ...common,
          border: "1px dashed #cbd5e1",
          background:
            "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 4px, #e2e8f0 4px, #e2e8f0 8px)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...common,
        background,
        border: "1px solid #ddd",
      }}
    />
  );
}
