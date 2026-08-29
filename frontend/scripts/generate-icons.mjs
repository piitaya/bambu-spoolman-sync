// Generates the PNG icons in public/ from public/icon.svg.
// Run with: npm run generate-icons (from frontend/)
//
// iOS Safari ignores SVG manifest icons and apple-touch-icon must be an
// opaque PNG (transparent corners render black on the home screen), which
// is why the SVG alone isn't enough.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const svg = await readFile(path.join(publicDir, "icon.svg"));

const BACKGROUND = "#228BE6"; // matches the icon's own background

const render = (size) => sharp(svg, { density: 300 }).resize(size, size).png();

// Standard manifest icons: the SVG as-is, rounded corners kept.
for (const size of [192, 512]) {
  await render(size).toFile(path.join(publicDir, `pwa-${size}x${size}.png`));
}

// Maskable icon: full-bleed background with the artwork shrunk into the
// safe zone, so any platform mask (circle, squircle, ...) never clips it.
const MASKABLE_SIZE = 512;
const SAFE_ZONE = 0.8;
const inner = Math.round(MASKABLE_SIZE * SAFE_ZONE);
await sharp({
  create: {
    width: MASKABLE_SIZE,
    height: MASKABLE_SIZE,
    channels: 4,
    background: BACKGROUND,
  },
})
  .composite([{ input: await render(inner).toBuffer(), gravity: "center" }])
  .png()
  .toFile(
    path.join(publicDir, `maskable-${MASKABLE_SIZE}x${MASKABLE_SIZE}.png`),
  );

// Apple touch icon: opaque, square — iOS applies its own corner rounding.
await render(180)
  .flatten({ background: BACKGROUND })
  .toFile(path.join(publicDir, "apple-touch-icon.png"));

console.log("Icons written to", publicDir);
