// Bambu reports `"00000000"` (all zeros, including alpha) when a tray
// has no known color. Any other value is a real color — including
// `"000000FF"` (opaque black) and `"FFFFFFFF"` (opaque white), which
// are valid filament colors we must render as-is.
export function swatchFill(hex: string | null | undefined): string | null {
  if (!hex || hex === "00000000") return null;
  const clean = hex.replace(/^#/, "").slice(0, 6);
  return clean.length > 0 ? `#${clean}` : null;
}

/**
 * Returns a CSS `background` value for a filament's color(s): a single color
 * string when there's one hex, a hard-stop 135° linear gradient when there are
 * multiple (e.g. bicolor PLA). Returns null when no valid colors.
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
  hexes: ReadonlyArray<string | null | undefined>;
  size?: number;
  /** Render as a circle instead of a rounded square. */
  round?: boolean;
}

export function ColorSwatch({ hexes, size = 20, round = false }: Props) {
  const background = swatchBackground(hexes);

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
          border: "1px dashed var(--mantine-color-default-border)",
          background:
            "repeating-linear-gradient(45deg, var(--mantine-color-default), var(--mantine-color-default) 4px, var(--mantine-color-gray-3) 4px, var(--mantine-color-gray-3) 8px)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...common,
        background,
        border: "1px solid var(--mantine-color-default-border)",
      }}
    />
  );
}
