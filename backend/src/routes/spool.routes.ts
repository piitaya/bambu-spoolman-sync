import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsync } from "fastify";
import { SpoolScanSchema, type SpoolScan } from "../domain/spool.js";
import type { RouteDeps } from "../context.js";
import { syncSpool } from "../services/sync.service.js";
import { scanSpool } from "../services/scan.service.js";
import { ErrorResponse, SpoolResponse, MatchTypeEnum } from "./schemas.js";
import { errorMessage } from "../utils.js";

export const spoolRoutes: FastifyPluginAsync<RouteDeps> = async (app, { ctx }) => {
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
