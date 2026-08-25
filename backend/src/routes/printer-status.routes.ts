import type { FastifyPluginAsync } from "fastify";
import {
  listPrinterStatuses,
  type PrinterStatusDeps,
} from "../services/printer-status.js";

export const printerStatusRoutes: FastifyPluginAsync<
  PrinterStatusDeps
> = async (app, deps) => {
  app.get(
    "/api/printer-statuses",
    {
      schema: {
        operationId: "listPrinterStatuses",
        tags: ["Printers"],
        description: "Live printer status and AMS contents.",
      },
    },
    async () => listPrinterStatuses(deps),
  );
};
