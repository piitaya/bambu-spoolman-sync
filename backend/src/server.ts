import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { configPath, loadConfig, type Config } from "./config.js";
import { createMapping, mappingCachePath, type Mapping } from "./mapping.js";
import { registerRoutes } from "./api.js";
import {
  createMqttState,
  disconnectAll,
  syncPrinters,
  type MqttState,
} from "./mqtt.js";

const MAPPING_SOURCE_URL =
  "https://raw.githubusercontent.com/piitaya/bambu-spoolman-db/main/filaments.json";

export interface AppContext {
  config: Config;
  configFilePath: string;
  mapping: Mapping;
  mqttState: MqttState;
  syncFromConfig(): void;
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  const configFilePath = configPath();
  const config = await loadConfig(configFilePath);

  const mapping = await createMapping({
    url: MAPPING_SOURCE_URL,
    cachePath: mappingCachePath(),
    intervalHours: config.mapping.refresh_interval_hours,
    onError: (err) => app.log.warn({ err }, "mapping refresh failed"),
  });

  const mqttState = createMqttState();

  const ctx: AppContext = {
    config,
    configFilePath,
    mapping,
    mqttState,
    syncFromConfig() {
      mapping.setInterval(ctx.config.mapping.refresh_interval_hours);
      syncPrinters(ctx.config.printers, mqttState, (printer, status) =>
        app.log.info(
          { serial: printer.serial, name: printer.name, status },
          "printer status",
        ),
      );
    },
  };

  ctx.syncFromConfig();
  await registerRoutes(app, ctx);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const frontendDist = resolve(__dirname, "../../frontend/dist");
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: "/",
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.type("text/html").sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    await disconnectAll(mqttState);
    mapping.stop();
  });

  return { app, ctx };
}

const isMain =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  buildApp()
    .then(async ({ app }) => {
      const shutdown = async (signal: string) => {
        app.log.info({ signal }, "shutting down");
        try {
          await app.close();
        } catch (err) {
          app.log.error({ err }, "error during shutdown");
        }
        process.exit(0);
      };
      process.once("SIGINT", () => void shutdown("SIGINT"));
      process.once("SIGTERM", () => void shutdown("SIGTERM"));
      await app.listen({ port, host });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
