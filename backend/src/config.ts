import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

export const PrinterSchema = z.object({
  // `serial` is the identity: it's unique per physical Bambu printer,
  // immutable after creation, and already part of the MQTT topic
  // prefix we subscribe to. No separate UUID.
  name: z.string().min(1),
  host: z.string().min(1),
  serial: z.string().min(1),
  access_code: z.string().min(1),
  enabled: z.boolean().default(true)
});
export type Printer = z.infer<typeof PrinterSchema>;

export const ConfigSchema = z.object({
  printers: z.array(PrinterSchema).default([]),
  mapping: z
    .object({
      refresh_interval_hours: z.number().int().positive().default(24)
    })
    .default({})
});
export type Config = z.infer<typeof ConfigSchema>;

export function dataDir(): string {
  return process.env.DATA_DIR ?? resolve(process.cwd(), "data");
}

export function configPath(): string {
  return resolve(dataDir(), "config.json");
}

export async function loadConfig(path: string): Promise<Config> {
  try {
    const raw = await readFile(path, "utf-8");
    return ConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return ConfigSchema.parse({});
    }
    throw err;
  }
}

export async function saveConfig(path: string, config: Config): Promise<Config> {
  const validated = ConfigSchema.parse(config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(validated, null, 2), "utf-8");
  return validated;
}
