import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigSchema, loadConfig, saveConfig } from "./config.js";

describe("ConfigSchema", () => {
  it("applies defaults to an empty object", () => {
    const c = ConfigSchema.parse({});
    expect(c.printers).toEqual([]);
    expect(c.mapping.refresh_interval_hours).toBe(24);
  });

  it("rejects a printer missing required fields", () => {
    expect(() =>
      ConfigSchema.parse({
        printers: [{ name: "x" }]
      })
    ).toThrow();
  });

  it("rejects a printer with an empty serial", () => {
    expect(() =>
      ConfigSchema.parse({
        printers: [
          {
            name: "x",
            host: "1.2.3.4",
            serial: "",
            access_code: "abc"
          }
        ]
      })
    ).toThrow();
  });
});

describe("loadConfig / saveConfig", () => {
  it("returns defaults when the file does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bsync-"));
    try {
      const c = await loadConfig(join(dir, "missing.json"));
      expect(c.printers).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("round-trips a config through disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bsync-"));
    const path = join(dir, "config.json");
    try {
      const written = await saveConfig(path, {
        printers: [
          {
            name: "X1C",
            host: "10.0.0.1",
            serial: "AC12",
            access_code: "xxx",
            enabled: true
          }
        ],
        mapping: {
          refresh_interval_hours: 12
        }
      });
      expect(written.printers).toHaveLength(1);
      const read = await loadConfig(path);
      expect(read).toEqual(written);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
