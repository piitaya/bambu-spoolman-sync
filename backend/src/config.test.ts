import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, ConfigSchema } from "./config.js";
import { Value } from "@sinclair/typebox/value";

describe("ConfigSchema", () => {
  it("applies defaults to an empty object", () => {
    const coerced = Value.Default(ConfigSchema, {});
    Value.Clean(ConfigSchema, coerced);
    expect(Value.Check(ConfigSchema, coerced)).toBe(true);
    const c = coerced as {
      printers?: unknown;
      spool_views?: unknown;
      filament_views?: unknown;
    };
    expect(c.printers).toEqual([]);
    expect(c.spool_views).toEqual([]);
    expect(c.filament_views).toEqual([]);
  });

  it("accepts saved views and rejects malformed ones", () => {
    const valid = Value.Default(
      ConfigSchema,
      Value.Clone({
        spool_views: [
          {
            id: "p1",
            name: "Low stock",
            state: {
              stock: "low",
              sort: { field: "remain", direction: "asc" },
            },
          },
        ],
        filament_views: [
          {
            id: "p2",
            name: "PLA",
            state: { materials: ["PLA"], ownership: "owned" },
          },
        ],
      }),
    );
    expect(Value.Check(ConfigSchema, valid)).toBe(true);

    const invalid = Value.Default(
      ConfigSchema,
      Value.Clone({
        spool_views: [{ id: "", name: "x", state: {} }],
      }),
    );
    expect(Value.Check(ConfigSchema, invalid)).toBe(false);

    const badStock = Value.Default(
      ConfigSchema,
      Value.Clone({
        spool_views: [{ id: "p1", name: "x", state: { stock: "bogus" } }],
      }),
    );
    expect(Value.Check(ConfigSchema, badStock)).toBe(false);
  });

  it("fills saved view state defaults", () => {
    const coerced = Value.Default(
      ConfigSchema,
      Value.Clone({ spool_views: [{ id: "p1", name: "x" }] }),
    );
    Value.Clean(ConfigSchema, coerced);
    expect(Value.Check(ConfigSchema, coerced)).toBe(true);
    const view = (coerced as { spool_views: { state: unknown }[] })
      .spool_views[0];
    expect(view.state).toEqual({
      materials: [],
      products: [],
      color_families: [],
      sort: { field: "product", direction: "asc" },
      group_by: "product",
      stock: "all",
      ams_only: false,
      no_remain: false,
    });
  });

  it("rejects a printer missing required fields", () => {
    expect(Value.Check(ConfigSchema, { printers: [{ name: "x" }] })).toBe(
      false,
    );
  });

  it("rejects a printer with an empty serial", () => {
    expect(
      Value.Check(ConfigSchema, {
        printers: [
          { name: "x", host: "1.2.3.4", serial: "", access_code: "abc" },
        ],
      }),
    ).toBe(false);
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
            enabled: true,
          },
        ],
      });
      expect(written.printers).toHaveLength(1);
      const read = await loadConfig(path);
      expect(read).toEqual(written);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
