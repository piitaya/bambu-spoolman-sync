import { describe, expect, it } from "vitest";
import {
  classifyMqttError,
  decodeNozzleId,
  parseAmsReport
} from "./mqtt.js";

const mqttErr = (
  init: { code?: number | string; message?: string }
): Error & { code?: number | string } => {
  const e = new Error(init.message ?? "") as Error & {
    code?: number | string;
  };
  if (init.code !== undefined) e.code = init.code;
  return e;
};

describe("parseAmsReport", () => {
  it("flattens ams[].tray[] into a slot list", () => {
    const payload = {
      print: {
        ams: {
          ams: [
            {
              id: 0,
              info: "1003",
              tray: [
                {
                  id: 0,
                  tray_id_name: "A01-B6",
                  tray_sub_brands: "PLA Matte",
                  tray_type: "PLA",
                  tray_color: "042F56FF",
                  tray_uuid: "UUID-A",
                  nozzle_temp_min: 220,
                  nozzle_temp_max: 240,
                  tray_weight: "1000",
                  remain: 87
                },
                {
                  id: 1,
                  tray_id_name: null,
                  tray_sub_brands: null,
                  tray_type: null
                }
              ]
            }
          ]
        }
      }
    };
    const slots = parseAmsReport("AC12", payload);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      printer_serial: "AC12",
      ams_id: 0,
      nozzle_id: 0,
      slot_id: 0,
      tray_id_name: "A01-B6",
      remain: 87,
      nozzle_temp_min: 220
    });
    expect(slots[1]).toMatchObject({
      slot_id: 1,
      tray_id_name: null,
      remain: null,
      nozzle_id: 0
    });
  });

  it("returns [] when the payload has no ams report", () => {
    expect(parseAmsReport("AC12", {})).toEqual([]);
    expect(parseAmsReport("AC12", { print: {} })).toEqual([]);
    expect(parseAmsReport("AC12", null)).toEqual([]);
  });

  it("handles multiple AMS units", () => {
    const payload = {
      print: {
        ams: {
          ams: [
            { id: 0, tray: [{ id: 0, tray_id_name: "A01-B6" }] },
            { id: 1, tray: [{ id: 0, tray_id_name: "A01-B7" }] }
          ]
        }
      }
    };
    const slots = parseAmsReport("AC12", payload);
    expect(slots).toHaveLength(2);
    expect(slots[0].ams_id).toBe(0);
    expect(slots[1].ams_id).toBe(1);
  });

  it("decodes nozzle_id from the AMS info hex field on an H2C-shaped payload", () => {
    const payload = {
      print: {
        ams: {
          ams: [
            { id: 0, info: "1003", tray: [{ id: 0 }] }, // right
            { id: 1, info: "2003", tray: [{ id: 0 }] }, // right
            { id: 128, info: "2104", tray: [{ id: 0 }] } // left (HT)
          ]
        }
      }
    };
    const slots = parseAmsReport("AC12", payload);
    expect(slots.map((s) => [s.ams_id, s.nozzle_id])).toEqual([
      [0, 0],
      [1, 0],
      [128, 1]
    ]);
  });
});

describe("decodeNozzleId", () => {
  it("decodes right-nozzle info values", () => {
    expect(decodeNozzleId("1003")).toBe(0);
    expect(decodeNozzleId("2003")).toBe(0);
  });

  it("decodes left-nozzle info values", () => {
    expect(decodeNozzleId("2104")).toBe(1);
  });

  it("returns null for the 0xE uninitialized sentinel", () => {
    expect(decodeNozzleId("1E03")).toBeNull();
  });

  it("returns null for missing or unparseable values", () => {
    expect(decodeNozzleId(null)).toBeNull();
    expect(decodeNozzleId(undefined)).toBeNull();
    expect(decodeNozzleId("zzz")).toBeNull();
  });
});

describe("classifyMqttError", () => {
  it("classifies CONNACK code 4 (bad username/password) as unauthorized", () => {
    expect(classifyMqttError(mqttErr({ code: 4, message: "..." }))).toBe(
      "unauthorized"
    );
  });

  it("classifies CONNACK code 5 (not authorized) as unauthorized", () => {
    expect(classifyMqttError(mqttErr({ code: 5, message: "..." }))).toBe(
      "unauthorized"
    );
  });

  it("falls back to message regex for 'Not authorized'", () => {
    expect(
      classifyMqttError(mqttErr({ message: "Connection refused: Not authorized" }))
    ).toBe("unauthorized");
  });

  it("classifies network syscall codes as unreachable", () => {
    expect(classifyMqttError(mqttErr({ code: "EACCES" }))).toBe("unreachable");
    expect(classifyMqttError(mqttErr({ code: "ECONNREFUSED" }))).toBe(
      "unreachable"
    );
    expect(classifyMqttError(mqttErr({ code: "ETIMEDOUT" }))).toBe(
      "unreachable"
    );
    expect(classifyMqttError(mqttErr({ code: "ENOTFOUND" }))).toBe(
      "unreachable"
    );
  });

  it("falls back to 'connect EXXX' message regex for unreachable", () => {
    expect(
      classifyMqttError(
        mqttErr({ message: "connect EACCES 10.0.0.0:8883 - Local (10.0.100.1:55326)" })
      )
    ).toBe("unreachable");
  });

  it("returns 'other' for unknown errors", () => {
    expect(classifyMqttError(mqttErr({ message: "weird mystery error" }))).toBe(
      "other"
    );
  });
});
