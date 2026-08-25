import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type {
  CatalogEntry,
  Printer,
  Spool,
  SpoolHistoryEvent,
} from "@pandaroo/shared";
import { createMcpServer, type McpDeps } from "./server.js";

function makeSpool(over: Partial<Spool>): Spool {
  return {
    tag_id: "TAG",
    variant_id: null,
    match_type: "third_party",
    material: null,
    product: null,
    color_hex: null,
    color_hexes: null,
    color_name: null,
    weight: null,
    remain: null,
    temp_min: null,
    temp_max: null,
    last_used: null,
    first_seen: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function makeEntry(
  over: Partial<CatalogEntry> &
    Pick<CatalogEntry, "id" | "sku" | "product" | "color_name">,
): CatalogEntry {
  return {
    material: "PLA",
    color_hex: "000000",
    color_hexes: [],
    weight: 1000,
    temp_min: 190,
    temp_max: 230,
    integrations: {},
    ...over,
  };
}

const catalog = new Map<string, CatalogEntry>(
  [
    makeEntry({
      id: "A00-K0",
      sku: "10101",
      product: "PLA Basic",
      color_name: "Black",
    }),
    makeEntry({
      id: "A01-K1",
      sku: "11101",
      product: "PLA Matte",
      color_name: "Charcoal",
    }),
    makeEntry({
      id: "A00-W0",
      sku: "10100",
      product: "PLA Basic",
      color_name: "Jade White",
    }),
    makeEntry({
      id: "G02-K0",
      sku: "33101",
      product: "PETG HF",
      color_name: "Black",
      material: "PETG",
    }),
  ].map((e) => [e.id, e]),
);

const spools: Spool[] = [
  makeSpool({
    tag_id: "T-WHITE",
    variant_id: "A00-W0",
    match_type: "known",
    material: "PLA",
    product: "PLA Basic",
    color_name: "Jade White",
    weight: 1000,
    remain: 90,
  }),
  makeSpool({
    tag_id: "T-PETG",
    variant_id: "G02-K0",
    match_type: "known",
    material: "PETG",
    product: "PETG HF",
    color_name: "Black",
    weight: 1000,
    remain: null,
  }),
  makeSpool({
    tag_id: "T-BLACK",
    variant_id: "A00-K0",
    match_type: "known",
    material: "PLA",
    product: "PLA Basic",
    color_name: "Black",
    weight: 1000,
    remain: 40,
    last_used: "2026-05-01T10:00:00.000Z",
  }),
];

const printers: Printer[] = [
  {
    serial: "SERIAL-1",
    name: "X1C",
    enabled: true,
    status: { lastError: null, errorCode: null },
    ams_units: [
      {
        id: 0,
        nozzle_id: null,
        slots: [
          {
            ams_id: 0,
            slot_id: 0,
            nozzle_id: null,
            has_spool: true,
            match_type: "known",
            color_name: "Black",
            reading: {
              tag_id: "T-BLACK",
              variant_id: "A00-K0",
              material: "PLA",
              product: "PLA Basic",
              color_hex: "000000FF",
              color_hexes: null,
              weight: 1000,
              temp_min: 190,
              temp_max: 230,
              remain: 40,
            },
          },
          {
            ams_id: 0,
            slot_id: 1,
            nozzle_id: null,
            has_spool: false,
            match_type: "empty",
            color_name: null,
            reading: null,
          },
        ],
      },
    ],
  },
  {
    serial: "SERIAL-2",
    name: "A1 mini",
    enabled: true,
    status: { lastError: "Printer not responding", errorCode: "no_response" },
    ams_units: [],
  },
];

const history: SpoolHistoryEvent[] = [
  {
    id: 2,
    tag_id: "T-BLACK",
    event_type: "ams_load",
    printer_serial: "SERIAL-1",
    ams_id: 0,
    slot_id: 0,
    remain: 40,
    weight: 1000,
    created_at: "2026-05-01T10:00:00.000Z",
  },
  {
    id: 1,
    tag_id: "T-BLACK",
    event_type: "adjust",
    printer_serial: null,
    ams_id: null,
    slot_id: null,
    remain: 55,
    weight: null,
    created_at: "2026-04-20T10:00:00.000Z",
  },
];

const deps: McpDeps = {
  spoolService: {
    list: () => spools,
    findByTagId: (tagId) => spools.find((s) => s.tag_id === tagId),
  },
  spoolHistoryService: {
    list: (tagId, { limit }) =>
      history.filter((e) => e.tag_id === tagId).slice(0, limit),
  },
  mapping: { byId: catalog },
  listPrinters: () => printers,
};

async function connect(): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await createMcpServer(deps).connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  const text = content[0]!.text;
  return result.isError
    ? { isError: true, text }
    : { isError: false, data: JSON.parse(text) };
}

describe("MCP server", () => {
  it("exposes four read-only tools", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_ams_state",
      "get_spool",
      "list_spools",
      "search_catalog",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });
});

describe("list_spools", () => {
  it("sorts by material, product, color and computes remaining grams", async () => {
    const client = await connect();
    const { data } = await call(client, "list_spools");
    expect(data.count).toBe(3);
    expect(data.spools.map((s: { tag_id: string }) => s.tag_id)).toEqual([
      "T-PETG",
      "T-BLACK",
      "T-WHITE",
    ]);
    const black = data.spools[1];
    expect(black.remaining_g).toBe(400);
    expect(black.sku).toBe("10101");
    expect(black.location).toEqual({ printer: "X1C", ams_id: 0, slot_id: 0 });
    expect(data.spools[0].remain_percent).toBeNull();
    expect(data.spools[0].remaining_g).toBeNull();
    expect(data.spools[2].location).toBeNull();
  });

  it("filters by material and color, case-insensitive", async () => {
    const client = await connect();
    const byMaterial = await call(client, "list_spools", { material: "pla" });
    expect(byMaterial.data.count).toBe(2);
    const byColor = await call(client, "list_spools", {
      material: "PLA",
      color: "bla",
    });
    expect(
      byColor.data.spools.map((s: { tag_id: string }) => s.tag_id),
    ).toEqual(["T-BLACK"]);
  });

  it("filters by printer name or serial", async () => {
    const client = await connect();
    const byName = await call(client, "list_spools", { printer: "x1c" });
    expect(byName.data.spools.map((s: { tag_id: string }) => s.tag_id)).toEqual(
      ["T-BLACK"],
    );
    const bySerial = await call(client, "list_spools", { printer: "SERIAL-1" });
    expect(bySerial.data.count).toBe(1);
    const none = await call(client, "list_spools", { printer: "A1 mini" });
    expect(none.data.count).toBe(0);
  });
});

describe("get_spool", () => {
  it("returns details and history with printer names resolved", async () => {
    const client = await connect();
    const { data } = await call(client, "get_spool", { tag_id: "T-BLACK" });
    expect(data.variant_id).toBe("A00-K0");
    expect(data.location).toEqual({ printer: "X1C", ams_id: 0, slot_id: 0 });
    expect(data.history).toEqual([
      {
        type: "ams_load",
        at: "2026-05-01T10:00:00.000Z",
        printer: "X1C",
        ams_id: 0,
        slot_id: 0,
        remain_percent: 40,
      },
      {
        type: "adjust",
        at: "2026-04-20T10:00:00.000Z",
        printer: null,
        ams_id: null,
        slot_id: null,
        remain_percent: 55,
      },
    ]);
  });

  it("reports unknown tag ids as tool errors", async () => {
    const client = await connect();
    const result = await call(client, "get_spool", { tag_id: "NOPE" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("NOPE");
  });
});

describe("get_ams_state", () => {
  it("lists slots with their status and printer errors", async () => {
    const client = await connect();
    const { data } = await call(client, "get_ams_state");
    expect(data.printers).toHaveLength(2);
    const [x1c, a1] = data.printers;
    expect(x1c.error).toBeNull();
    expect(x1c.ams_units[0].slots).toEqual([
      {
        slot_id: 0,
        status: "known",
        tag_id: "T-BLACK",
        material: "PLA",
        product: "PLA Basic",
        color_name: "Black",
        color_hex: "000000FF",
        weight_g: 1000,
        remain_percent: 40,
        remaining_g: 400,
      },
      {
        slot_id: 1,
        status: "empty",
        tag_id: null,
        material: null,
        product: null,
        color_name: null,
        color_hex: null,
        weight_g: null,
        remain_percent: null,
        remaining_g: null,
      },
    ]);
    expect(a1.error).toBe("Printer not responding");
    expect(a1.ams_units).toEqual([]);
  });
});

describe("search_catalog", () => {
  it("matches every query word against product, color and sku", async () => {
    const client = await connect();
    const { data } = await call(client, "search_catalog", {
      query: "basic black",
    });
    expect(data.total).toBe(1);
    expect(data.entries[0]).toMatchObject({
      variant_id: "A00-K0",
      sku: "10101",
    });
    const bySku = await call(client, "search_catalog", { query: "11101" });
    expect(bySku.data.entries[0].variant_id).toBe("A01-K1");
  });

  it("filters by material and applies the limit", async () => {
    const client = await connect();
    const petg = await call(client, "search_catalog", { material: "petg" });
    expect(
      petg.data.entries.map((e: { variant_id: string }) => e.variant_id),
    ).toEqual(["G02-K0"]);
    const limited = await call(client, "search_catalog", {
      material: "PLA",
      limit: 2,
    });
    expect(limited.data.total).toBe(3);
    expect(limited.data.entries).toHaveLength(2);
  });
});
