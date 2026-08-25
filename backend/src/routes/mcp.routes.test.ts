import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { mcpRoutes } from "./mcp.routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(mcpRoutes, {
    spoolService: { list: () => [], findByTagId: () => undefined },
    spoolHistoryService: { list: () => [] },
    mapping: { byId: new Map() },
    listPrinters: () => [],
  });
  return app;
}

const headers = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

describe("POST /mcp", () => {
  it("answers JSON-RPC requests statelessly", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      headers,
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.tools.map((t: { name: string }) => t.name)).toContain(
      "list_spools",
    );
    expect(res.headers["mcp-session-id"]).toBeUndefined();
  });

  it("rejects GET and DELETE with 405", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/mcp", headers });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });
});
