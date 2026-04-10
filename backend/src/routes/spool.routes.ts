import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsync } from "fastify";
import { SpoolScanSchema, type SpoolScan } from "../domain/spool.js";
import type { RouteDeps } from "../context.js";
import { syncSpool } from "../services/sync.service.js";
import { scanSpool } from "../services/scan.service.js";
import { ErrorResponse, SpoolResponse, MatchTypeEnum, LocalSpoolResponse } from "./schemas.js";
import { errorMessage } from "../utils.js";

export const spoolRoutes: FastifyPluginAsync<RouteDeps> = async (app, { ctx }) => {
  app.get("/api/spools", {
    schema: {
      tags: ["Spools"],
      description: "List all locally tracked spools, enriched with filament name from community DB",
      response: { 200: Type.Array(LocalSpoolResponse) },
    },
  }, async () => {
    const rows = ctx.spoolRepo.list();
    return rows.map((row) => {
      const entry = row.variantId ? ctx.mapping.byId.get(row.variantId) : null;
      return {
        id: row.id,
        tag_id: row.tagId,
        variant_id: row.variantId,
        material: row.material,
        product: row.product,
        color_hex: row.colorHex,
        color_name: entry?.color_name ?? null,
        weight: row.weight,
        remain: row.remain,
        source: row.source,
        first_seen: row.firstSeen,
        last_seen: row.lastSeen,
      };
    });
  });

  app.post("/api/spools/scan", {
    schema: {
      tags: ["Spools"],
      description: "Scan a spool NFC tag and match against the filament database",
      body: SpoolScanSchema,
      response: {
        200: Type.Object({
          spool: SpoolResponse,
          match: MatchTypeEnum,
          sync_available: Type.Boolean(),
          synced: Type.Boolean(),
          archived: Type.Boolean(),
        }),
        400: ErrorResponse,
      },
    },
  }, async (req) => {
    return scanSpool(
      req.body as SpoolScan,
      ctx.mapping.byId,
      ctx.spoolRepo,
      ctx.config.spoolman.url,
    );
  });

  app.post("/api/spools/sync", {
    schema: {
      tags: ["Spools"],
      description: "Sync a scanned spool to Spoolman",
      body: SpoolScanSchema,
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        400: ErrorResponse,
      },
    },
  }, async (req, reply) => {
    const spool = req.body as SpoolScan;
    const { config } = ctx;
    const url = config.spoolman.url;
    if (!url) {
      reply.code(400);
      return { error: "Spoolman URL is not configured." };
    }
    try {
      await syncSpool(spool, ctx.mapping.byId, url, {
        archiveOnEmpty: config.spoolman.archive_on_empty ?? false,
      });
      return { success: true };
    } catch (err) {
      reply.code(400);
      return { error: errorMessage(err) };
    }
  });
};
