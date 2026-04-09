import type { FastifyPluginAsync } from "fastify";
import { matchSlot } from "../domain/matcher.js";
import type { RouteDeps } from "../context.js";
import { getSlotSyncView } from "../stores/sync-state.store.js";
import { listRuntimes } from "../clients/bambu.client.js";

export const stateRoutes: FastifyPluginAsync<RouteDeps> = async (app, { ctx }) => {
  app.get("/api/state", {
    schema: {
      tags: ["State"],
      description: "Get live printer status, AMS contents, and sync state",
    },
  }, async () => {
    const { config, mapping, mqttState, syncState } = ctx;
    const runtimes = listRuntimes(mqttState);
    const bySerial = new Map(runtimes.map((r) => [r.printer.serial, r]));

    const printers = config.printers.map((p) => {
      const runtime = bySerial.get(p.serial);
      const ams_units = (runtime?.ams_units ?? []).map((unit) => ({
        id: unit.id,
        nozzle_id: unit.nozzle_id,
        slots: unit.slots.map((slot) => ({
          slot,
          ...matchSlot(slot, mapping.byId),
          sync: getSlotSyncView(syncState, slot),
        })),
      }));

      return {
        serial: p.serial,
        name: p.name,
        enabled: p.enabled,
        status: runtime?.status ?? { lastError: null, errorCode: null },
        ams_units,
      };
    });

    return {
      printers,
      mapping: {
        count: mapping.byId.size,
        fetched_at: mapping.fetchedAt,
      },
    };
  });
};
