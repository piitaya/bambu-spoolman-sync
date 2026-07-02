import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { Config } from "@pandaroo/shared";
import { atomicWriteFile } from "./utils/atomic-write.js";

// Keep in sync with the `Config` interface in shared.
export const PrinterSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  host: Type.String({ minLength: 1 }),
  serial: Type.String({ minLength: 1 }),
  access_code: Type.String({ minLength: 1 }),
  enabled: Type.Boolean({ default: true }),
});
// sort.field and group_by stay open strings on purpose: removing or
// renaming one in the frontend must never make stored configs invalid.
// Unknown values fall back to defaults when the saved view is applied.
const SavedViewSortSchema = Type.Object(
  {
    field: Type.String({ minLength: 1 }),
    direction: Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
  },
  { default: { field: "product", direction: "asc" } },
);
const savedViewStateBase = {
  materials: Type.Array(Type.String(), { default: [] }),
  products: Type.Array(Type.String(), { default: [] }),
  color_families: Type.Array(Type.String(), { default: [] }),
  sort: SavedViewSortSchema,
  group_by: Type.String({ minLength: 1, default: "product" }),
};
export const SpoolSavedViewSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  state: Type.Object(
    {
      ...savedViewStateBase,
      stock: Type.Union(
        [Type.Literal("all"), Type.Literal("low"), Type.Literal("full")],
        { default: "all" },
      ),
      ams_only: Type.Boolean({ default: false }),
      no_remain: Type.Boolean({ default: false }),
    },
    { default: {} },
  ),
});
export const FilamentSavedViewSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  state: Type.Object(
    {
      ...savedViewStateBase,
      ownership: Type.Union(
        [Type.Literal("all"), Type.Literal("owned"), Type.Literal("not_owned")],
        { default: "all" },
      ),
    },
    { default: {} },
  ),
});
export const ConfigSchema = Type.Object({
  printers: Type.Array(PrinterSchema, { default: [] }),
  spool_views: Type.Array(SpoolSavedViewSchema, { default: [] }),
  filament_views: Type.Array(FilamentSavedViewSchema, { default: [] }),
});

function parseConfig(data: unknown): Config {
  const coerced = Value.Default(ConfigSchema, Value.Clone(data));
  Value.Clean(ConfigSchema, coerced);
  if (!Value.Check(ConfigSchema, coerced)) {
    const errors = [...Value.Errors(ConfigSchema, coerced)];
    throw new Error(
      `Invalid config: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
    );
  }
  return coerced;
}

export function dataDir(): string {
  return process.env.DATA_DIR ?? resolve(process.cwd(), "data");
}

export function configPath(): string {
  return resolve(dataDir(), "config.json");
}

export async function loadConfig(path: string): Promise<Config> {
  try {
    const raw = await readFile(path, "utf-8");
    return parseConfig(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return parseConfig({});
    }
    throw err;
  }
}

export async function saveConfig(
  path: string,
  config: Record<string, unknown>,
): Promise<Config> {
  const validated = parseConfig(config);
  await atomicWriteFile(path, JSON.stringify(validated, null, 2));
  return validated;
}
