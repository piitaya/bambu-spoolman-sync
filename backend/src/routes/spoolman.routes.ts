import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsync } from "fastify";
import { createSpoolmanClient } from "../clients/spoolman.client.js";
import type { RouteDeps } from "../context.js";
import { syncAll, syncSlot } from "../services/sync.service.js";
import { ErrorResponse, SyncOutcomeResponse, SyncAllResultResponse } from "./schemas.js";
import { errorMessage } from "../utils.js";

export const spoolmanRoutes: FastifyPluginAsync<RouteDeps> = async (app, { ctx }) => {
  app.post("/api/spoolman/test", {
    schema: {
      tags: ["Spoolman"],
      description: "Test Spoolman connectivity",
      response: {
        200: Type.Object({
          ok: Type.Boolean(),
          info: Type.Object({ version: Type.Optional(Type.String()) }),
          base_url: Type.Union([Type.String(), Type.Null()]),
        }),
        400: ErrorResponse,
        502: ErrorResponse,
      },
    },
  }, async (_req, reply) => {
    const url = ctx.config.spoolman.url;
    if (!url) {
      reply.code(400);
      return { error: "Spoolman URL is not configured." };
    }
    const signal = AbortSignal.timeout(3000);
    try {
      const client = createSpoolmanClient(url);
      const [info, base_url] = await Promise.all([
        client.getInfo(signal),
        client.getBaseUrl(signal),
      ]);
      return { ok: true, info, base_url };
    } catch (err) {
      reply.code(502);
      return { error: errorMessage(err) };
    }
  });

  app.post("/api/spoolman/sync", {
    schema: {
      tags: ["Spoolman"],
      description: "Sync all matched AMS slots to Spoolman",
      response: { 200: SyncAllResultResponse, 400: ErrorResponse },
    },
  }, async (_req, reply) => {
    try {
      return await syncAll(ctx);
    } catch (err) {
      reply.code(400);
      return { error: errorMessage(err) };
    }
  });

  app.post<{ Params: { serial: string; amsId: string; slotId: string } }>(
    "/api/spoolman/sync/:serial/:amsId/:slotId",
    {
      schema: {
        tags: ["Spoolman"],
        description: "Sync a single AMS slot to Spoolman",
        params: Type.Object({
          serial: Type.String(),
          amsId: Type.String(),
          slotId: Type.String(),
        }),
        response: { 200: SyncOutcomeResponse, 400: ErrorResponse },
      },
    },
    async (req, reply) => {
      const amsId = Number(req.params.amsId);
      const slotId = Number(req.params.slotId);
      if (!Number.isFinite(amsId) || !Number.isFinite(slotId)) {
        reply.code(400);
        return { error: "Invalid amsId or slotId." };
      }
      try {
        return await syncSlot(ctx, req.params.serial, amsId, slotId);
      } catch (err) {
        reply.code(400);
        return { error: errorMessage(err) };
      }
    },
  );
};
