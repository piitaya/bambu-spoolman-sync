import type { FastifyBaseLogger } from "fastify";
import type Database from "better-sqlite3";
import { saveConfig, type Config } from "./stores/config.store.js";
import type { Mapping } from "./stores/mapping.store.js";
import { createSyncStateStore, type SyncStateStore } from "./stores/sync-state.store.js";
import {
  createMqttState,
  disconnectAll,
  syncPrinters,
  type MqttState,
} from "./clients/bambu.client.js";
import { createAutoSync } from "./services/auto-sync.service.js";
import type { AppDatabase } from "./db/database.js";
import {
  createSpoolRepository,
  type SpoolRepository,
} from "./db/spool.repository.js";

export interface RouteDeps {
  ctx: AppContext;
}

export class AppContext {
  config: Config;
  readonly spoolRepo: SpoolRepository;
  readonly mapping: Mapping;
  readonly mqttState: MqttState;
  readonly syncState: SyncStateStore;

  private configFilePath: string;
  private log: FastifyBaseLogger;
  private sqlite: Database.Database;
  private currentAutoSync: ReturnType<typeof createAutoSync> | null = null;

  constructor(
    config: Config,
    configFilePath: string,
    db: AppDatabase,
    sqlite: Database.Database,
    mapping: Mapping,
    log: FastifyBaseLogger,
  ) {
    this.config = config;
    this.configFilePath = configFilePath;
    this.sqlite = sqlite;
    this.spoolRepo = createSpoolRepository(db);
    this.mapping = mapping;
    this.log = log;
    this.mqttState = createMqttState();
    this.syncState = createSyncStateStore();
  }

  syncFromConfig(): void {
    this.mapping.setInterval(this.config.mapping.refresh_interval_hours);
    this.currentAutoSync?.stop();
    this.currentAutoSync = createAutoSync(this, this.log);
    syncPrinters(
      this.config.printers,
      this.mqttState,
      (printer, status) =>
        this.log.info(
          { serial: printer.serial, name: printer.name, status },
          "printer status",
        ),
      this.currentAutoSync.onAmsUpdate,
    );
  }

  async applyConfig(next: Record<string, unknown>): Promise<void> {
    const validated = await saveConfig(this.configFilePath, next);
    this.config = validated;
    this.syncFromConfig();
  }

  async shutdown(): Promise<void> {
    this.currentAutoSync?.stop();
    await disconnectAll(this.mqttState);
    this.mapping.stop();
    this.sqlite.close();
  }
}
