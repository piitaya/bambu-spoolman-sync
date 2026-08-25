import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CatalogEntry, Printer, Spool } from "@pandaroo/shared";
import type { Mapping } from "../filament-catalog.js";
import type { SpoolService } from "../services/spool.service.js";
import type { SpoolHistoryService } from "../services/spool-history.service.js";

export interface McpDeps {
  spoolService: Pick<SpoolService, "list" | "findByTagId">;
  spoolHistoryService: Pick<SpoolHistoryService, "list">;
  mapping: Pick<Mapping, "byId">;
  listPrinters: () => Printer[];
}

const HISTORY_LIMIT = 20;
const CATALOG_DEFAULT_LIMIT = 50;
const CATALOG_MAX_LIMIT = 200;

interface SlotLocation {
  printer: string;
  serial: string;
  ams_id: number;
  slot_id: number;
}

function remainingGrams(
  weight: number | null,
  remain: number | null,
): number | null {
  if (weight == null || remain == null) return null;
  return Math.round((weight * remain) / 100);
}

function includes(haystack: string | null, needle: string): boolean {
  return (
    haystack != null && haystack.toLowerCase().includes(needle.toLowerCase())
  );
}

function locateSpools(printers: Printer[]): Map<string, SlotLocation> {
  const locations = new Map<string, SlotLocation>();
  for (const printer of printers) {
    for (const unit of printer.ams_units) {
      for (const slot of unit.slots) {
        const tagId = slot.reading?.tag_id;
        if (!tagId) continue;
        locations.set(tagId, {
          printer: printer.name,
          serial: printer.serial,
          ams_id: slot.ams_id,
          slot_id: slot.slot_id,
        });
      }
    }
  }
  return locations;
}

function summarizeSpool(
  spool: Spool,
  location: SlotLocation | undefined,
  catalog: Map<string, CatalogEntry>,
) {
  return {
    tag_id: spool.tag_id,
    match_type: spool.match_type,
    sku: (spool.variant_id && catalog.get(spool.variant_id)?.sku) || null,
    material: spool.material,
    product: spool.product,
    color_name: spool.color_name,
    color_hex: spool.color_hex,
    weight_g: spool.weight,
    remain_percent: spool.remain,
    remaining_g: remainingGrams(spool.weight, spool.remain),
    location: location
      ? {
          printer: location.printer,
          ams_id: location.ams_id,
          slot_id: location.slot_id,
        }
      : null,
    last_used: spool.last_used,
  };
}

function compareSpools(a: Spool, b: Spool): number {
  return (
    (a.material ?? "").localeCompare(b.material ?? "") ||
    (a.product ?? "").localeCompare(b.product ?? "") ||
    (a.color_name ?? "").localeCompare(b.color_name ?? "")
  );
}

function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const haystack = [
    entry.product,
    entry.color_name,
    entry.sku,
    entry.id,
    entry.material ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function compareEntries(a: CatalogEntry, b: CatalogEntry): number {
  return (
    (a.material ?? "").localeCompare(b.material ?? "") ||
    a.product.localeCompare(b.product) ||
    a.color_name.localeCompare(b.color_name)
  );
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

export function createMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: "pandaroo", version: "0.1.0" });

  server.registerTool(
    "list_spools",
    {
      title: "List spools",
      description:
        "List every tracked filament spool with how much filament is left and where it is. " +
        "Sorted by material, product, color. weight_g is the spool's initial filament weight in grams. " +
        "remain_percent comes from the AMS while loaded, or from the last manual adjustment; " +
        "null means unknown, not empty. location is null when the spool is on the shelf. " +
        "Use this for stock questions and to decide what to reorder.",
      inputSchema: {
        material: z
          .string()
          .optional()
          .describe("Material, case-insensitive substring (e.g. PLA, PETG)"),
        color: z
          .string()
          .optional()
          .describe("Color name, case-insensitive substring (e.g. black)"),
        printer: z
          .string()
          .optional()
          .describe(
            "Only spools loaded in this printer (name substring or serial)",
          ),
      },
      annotations: readOnly,
    },
    async ({ material, color, printer }) => {
      const locations = locateSpools(deps.listPrinters());
      const spools = deps.spoolService
        .list()
        .filter((s) => !material || includes(s.material, material))
        .filter((s) => !color || includes(s.color_name, color))
        .filter((s) => {
          if (!printer) return true;
          const location = locations.get(s.tag_id);
          return (
            !!location &&
            (includes(location.printer, printer) || location.serial === printer)
          );
        })
        .sort(compareSpools)
        .map((s) =>
          summarizeSpool(s, locations.get(s.tag_id), deps.mapping.byId),
        );
      return json({ count: spools.length, spools });
    },
  );

  server.registerTool(
    "get_spool",
    {
      title: "Get spool",
      description:
        "Details of one spool by RFID tag id, with its most recent history events " +
        "(ams_load, ams_unload, ams_update, scan, adjust), newest first.",
      inputSchema: {
        tag_id: z
          .string()
          .min(1)
          .describe("RFID tag id, as returned by list_spools"),
      },
      annotations: readOnly,
    },
    async ({ tag_id }) => {
      const spool = deps.spoolService.findByTagId(tag_id);
      if (!spool) return error(`No spool with tag id ${tag_id}.`);

      const printers = deps.listPrinters();
      const names = new Map(printers.map((p) => [p.serial, p.name]));
      const history = deps.spoolHistoryService
        .list(tag_id, { limit: HISTORY_LIMIT })
        .map((e) => ({
          type: e.event_type,
          at: e.created_at,
          printer: e.printer_serial
            ? (names.get(e.printer_serial) ?? e.printer_serial)
            : null,
          ams_id: e.ams_id,
          slot_id: e.slot_id,
          remain_percent: e.remain,
        }));

      return json({
        ...summarizeSpool(
          spool,
          locateSpools(printers).get(tag_id),
          deps.mapping.byId,
        ),
        variant_id: spool.variant_id,
        temp_min: spool.temp_min,
        temp_max: spool.temp_max,
        first_seen: spool.first_seen,
        history,
      });
    },
  );

  server.registerTool(
    "get_ams_state",
    {
      title: "Get AMS state",
      description:
        "Live state of every printer and AMS slot: what is loaded right now, empty slots, " +
        "and spools the app cannot identify. Slot status: known (Bambu spool in the catalog), " +
        "unknown (Bambu spool missing from the catalog), third_party, unidentified, empty. " +
        "error is set when the printer is unreachable.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () =>
      json({
        printers: deps.listPrinters().map((p) => ({
          name: p.name,
          serial: p.serial,
          enabled: p.enabled,
          error: p.status.lastError,
          ams_units: p.ams_units.map((unit) => ({
            ams_id: unit.id,
            slots: unit.slots.map((slot) => ({
              slot_id: slot.slot_id,
              status: slot.match_type,
              tag_id: slot.reading?.tag_id ?? null,
              material: slot.reading?.material ?? null,
              product: slot.reading?.product ?? null,
              color_name: slot.color_name,
              color_hex: slot.reading?.color_hex ?? null,
              weight_g: slot.reading?.weight ?? null,
              remain_percent: slot.reading?.remain ?? null,
              remaining_g: remainingGrams(
                slot.reading?.weight ?? null,
                slot.reading?.remain ?? null,
              ),
            })),
          })),
        })),
      }),
  );

  server.registerTool(
    "search_catalog",
    {
      title: "Search filament catalog",
      description:
        "Search the community-maintained catalog of official Bambu Lab filaments. " +
        "Use it to find the exact product and SKU to buy, or to see which colors exist for a material. " +
        "Returns at most `limit` entries; total is the number of matches.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Free text matched against product, color name and SKU; every word must match (e.g. 'matte black')",
          ),
        material: z
          .string()
          .optional()
          .describe("Material, case-insensitive substring (e.g. PLA, PETG)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(CATALOG_MAX_LIMIT)
          .optional()
          .describe(`Max entries to return, default ${CATALOG_DEFAULT_LIMIT}`),
      },
      annotations: readOnly,
    },
    async ({ query, material, limit }) => {
      const matches = Array.from(deps.mapping.byId.values())
        .filter((e) => !material || includes(e.material, material))
        .filter((e) => !query || matchesQuery(e, query))
        .sort(compareEntries);
      const entries = matches
        .slice(0, limit ?? CATALOG_DEFAULT_LIMIT)
        .map((e) => ({
          variant_id: e.id,
          sku: e.sku,
          material: e.material,
          product: e.product,
          color_name: e.color_name,
          color_hex: e.color_hex,
          weight_g: e.weight,
        }));
      return json({ total: matches.length, entries });
    },
  );

  return server;
}
