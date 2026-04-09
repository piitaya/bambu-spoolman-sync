import mqtt, { type MqttClient } from "mqtt";
import type { Printer } from "./config.js";
import { toSpool, type AmsUnit } from "./spool.js";

/**
 * Friendly error categories for the dashboard. The frontend looks
 * up an i18n title/description per code; "other" falls back to the
 * raw `lastError` string.
 */
export type PrinterErrorCode =
  | "unauthorized" // CONNACK 4/5 — bad access code
  | "no_response" // connected, never received a message — bad serial
  | "unreachable" // EACCES/ECONNREFUSED/ETIMEDOUT/ENOTFOUND/…
  | "other";

export interface PrinterStatus {
  lastError: string | null;
  errorCode: PrinterErrorCode | null;
}

const NETWORK_ERROR_CODES = new Set([
  "EACCES",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNRESET",
]);

/**
 * Classify a raw mqtt.js error into a friendly error code. Pure;
 * tested directly in mqtt.test.ts without spinning up a real client.
 */
export function classifyMqttError(
  err: Error & { code?: number | string },
): PrinterErrorCode {
  // mqtt.js exposes the MQTT 3.1.1 CONNACK return code on `code`.
  // 4 = bad username/password, 5 = not authorized.
  if (err.code === 4 || err.code === 5) return "unauthorized";

  // Belt-and-braces: some mqtt.js versions drop the numeric code but
  // keep the human suffix.
  if (/not authorized|bad username|bad password/i.test(err.message)) {
    return "unauthorized";
  }

  // Node syscall errors — string codes.
  if (typeof err.code === "string" && NETWORK_ERROR_CODES.has(err.code)) {
    return "unreachable";
  }

  // The Node `connect` error message embeds the syscall name when
  // `.code` is missing — sniff for it.
  if (/^connect E[A-Z]+ /.test(err.message)) return "unreachable";

  return "other";
}

export interface PrinterRuntime {
  printer: Printer;
  status: PrinterStatus;
  ams_units: AmsUnit[];
  disconnect(): Promise<void>;
}

export type OnStatus = (printer: Printer, status: PrinterStatus) => void;
export type OnAmsUpdate = (printer: Printer, ams_units: AmsUnit[]) => void;

/**
 * Decode the nozzle (extruder) assignment from an AMS `info` hex string.
 * Bits 8–11 encode the extruder id, per BambuStudio's `DevFilaSystem.cpp`:
 *   0 → right / main nozzle
 *   1 → left / deputy nozzle
 *   0xE → uninitialized (return null)
 * Returns null for missing/unparseable values.
 */
export function decodeNozzleId(info: unknown): number | null {
  if (info == null) return null;
  const parsed = parseInt(String(info), 16);
  if (!Number.isFinite(parsed)) return null;
  const id = (parsed >> 8) & 0xf;
  if (id === 0xe) return null;
  return id;
}

/**
 * Decode a hex bitmask string (e.g. `"1d"`, `"100ff"`) into a number.
 * Returns null if the value is missing or unparseable.
 */
function parseHexBits(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const n = parseInt(value, 16);
  return Number.isFinite(n) ? n : null;
}

export function parseAmsReport(
  printerSerial: string,
  payload: unknown,
): AmsUnit[] {
  const amsPayload = (payload as any)?.print?.ams;
  const trayExistBits = parseHexBits(amsPayload?.tray_exist_bits);
  const amsList = amsPayload?.ams;
  if (!Array.isArray(amsList)) return [];

  const units: AmsUnit[] = [];
  for (const ams of amsList) {
    const amsId = Number(ams?.id ?? 0);
    const nozzleId = decodeNozzleId(ams?.info);
    const trays: unknown[] = Array.isArray(ams?.tray) ? ams.tray : [];
    const slots = trays.map((tray) => {
      const t = tray as Record<string, unknown> | null;
      const slotId = Number(t?.id ?? 0);
      const globalBit = amsId * 4 + slotId;
      const hasSpool =
        trayExistBits != null ? ((trayExistBits >> globalBit) & 1) === 1 : true;
      return {
        printer_serial: printerSerial,
        ams_id: amsId,
        slot_id: slotId,
        nozzle_id: nozzleId,
        has_spool: hasSpool,
        spool: hasSpool ? toSpool(tray) : null,
      };
    });
    slots.sort((a, b) => a.slot_id - b.slot_id);
    units.push({ id: amsId, nozzle_id: nozzleId, slots });
  }
  return units;
}

interface InternalClient {
  printer: Printer;
  status: PrinterStatus;
  ams_units: AmsUnit[];
  mqtt: MqttClient;
  disconnect(): Promise<void>;
}

function connect(
  printer: Printer,
  onStatus?: OnStatus,
  onAmsUpdate?: OnAmsUpdate,
): InternalClient {
  const status: PrinterStatus = {
    lastError: null,
    errorCode: null,
  };
  const amsUnits: AmsUnit[] = [];
  let hasEverReceivedMessage = false;
  let watchdog: NodeJS.Timeout | null = null;

  const emitStatus = () => onStatus?.(printer, { ...status });

  // Wrong-serial detection: after a successful CONNECT we publish
  // `pushall` and expect the printer to start streaming state within
  // a couple of seconds. If nothing arrives in 15s, the most likely
  // cause is a wrong serial in the topic prefix — surface it as a
  // friendly "no_response" error rather than spinning forever.
  const armWatchdog = () => {
    if (hasEverReceivedMessage || watchdog) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (hasEverReceivedMessage) return;
      status.errorCode = "no_response";
      status.lastError = null;
      emitStatus();
    }, 15_000);
  };

  const clearWatchdog = () => {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  const url = `mqtts://${printer.host}:8883`;
  const client = mqtt.connect(url, {
    username: "bblp",
    password: printer.access_code,
    // Bambu printers serve a self-signed cert on the local broker —
    // there's no realistic way to get a CA-signed cert for a LAN-only
    // device, so we skip cert validation.
    rejectUnauthorized: false,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clientId: `bsync-${printer.serial.slice(-6)}-${Math.random()
      .toString(16)
      .slice(2, 8)}`,
  });

  const topic = `device/${printer.serial}/report`;

  client.on("connect", () => {
    status.lastError = null;
    status.errorCode = null;
    emitStatus();
    client.subscribe(topic, (err) => {
      if (err) {
        status.lastError = `subscribe: ${err.message}`;
        status.errorCode = "other";
        emitStatus();
      }
    });
    client.publish(
      `device/${printer.serial}/request`,
      JSON.stringify({ pushing: { sequence_id: "0", command: "pushall" } }),
    );
    armWatchdog();
  });

  client.on("error", (err) => {
    status.errorCode = classifyMqttError(err);
    status.lastError = err.message;
    emitStatus();
  });

  client.on("message", (_topic, msg) => {
    let payload: unknown;
    try {
      payload = JSON.parse(msg.toString());
    } catch {
      return;
    }
    if (!Array.isArray((payload as any)?.print?.ams?.ams)) return;
    const parsed = parseAmsReport(printer.serial, payload);
    amsUnits.length = 0;
    amsUnits.push(...parsed);
    hasEverReceivedMessage = true;
    clearWatchdog();
    status.errorCode = null;
    status.lastError = null;
    onAmsUpdate?.(printer, amsUnits);
  });

  return {
    printer,
    status,
    ams_units: amsUnits,
    mqtt: client,
    async disconnect() {
      clearWatchdog();
      // Give the graceful end 2s; after that, force-close. endAsync
      // resolves either when the DISCONNECT packet is flushed or when
      // force-end takes over, so we never leak a dangling client.
      const force = setTimeout(() => {
        try {
          client.end(true);
        } catch {}
      }, 2000);
      try {
        await client.endAsync();
      } catch {
        // Already torn down by the force timer — nothing to do.
      } finally {
        clearTimeout(force);
      }
    },
  };
}

export type MqttState = Map<string, InternalClient>;

export function createMqttState(): MqttState {
  return new Map();
}

/**
 * Reconcile the live MQTT clients against the target printer list.
 * Keyed by serial — which IS the printer identity. Clients whose
 * host or access_code changed are torn down and recreated; rename
 * or enabled toggles are applied without dropping the session.
 */
export function syncPrinters(
  target: Printer[],
  state: MqttState,
  onStatus?: OnStatus,
  onAmsUpdate?: OnAmsUpdate,
): void {
  const wanted = new Map(
    target.filter((p) => p.enabled).map((p) => [p.serial, p]),
  );

  for (const [serial, client] of state) {
    const next = wanted.get(serial);
    const changed =
      !next ||
      client.printer.host !== next.host ||
      client.printer.access_code !== next.access_code;
    if (changed) {
      client.disconnect().catch(() => {});
      state.delete(serial);
    } else {
      // Same connection params but potentially a different name —
      // replace the stored reference so callbacks see the fresh one.
      client.printer = next;
    }
  }

  for (const printer of wanted.values()) {
    if (state.has(printer.serial)) continue;
    state.set(printer.serial, connect(printer, onStatus, onAmsUpdate));
  }
}

export function listRuntimes(state: MqttState): PrinterRuntime[] {
  return Array.from(state.values()).map((c) => ({
    printer: c.printer,
    status: c.status,
    ams_units: c.ams_units,
    disconnect: c.disconnect,
  }));
}

export async function disconnectAll(state: MqttState): Promise<void> {
  await Promise.all(Array.from(state.values()).map((c) => c.disconnect()));
  state.clear();
}
