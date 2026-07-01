import { Type } from "@sinclair/typebox";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { appErrorHandler } from "./error-handler.js";
import { notFound } from "./routes/schemas.js";

async function buildTestApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler(appErrorHandler);
  app.get("/boom", () => {
    throw new Error("secret database path leaked");
  });
  app.post(
    "/validated",
    { schema: { body: Type.Object({ name: Type.String() }) } },
    async () => ({ ok: true }),
  );
  app.get("/missing", async (req, reply) =>
    notFound(reply, "Spool not found."),
  );
  await app.ready();
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

afterEach(async () => {
  await app.close();
});

describe("appErrorHandler", () => {
  it("returns a generic 500 envelope without leaking the error message", async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: "Internal server error.",
      code: "internal",
    });
  });

  it("keeps validation detail on schema failures", async () => {
    app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/validated",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; code: string };
    expect(body.code).toBe("validation");
    expect(body.error).toContain("name");
  });

  it("leaves route-authored error envelopes untouched", async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/missing" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "Spool not found.",
      code: "not_found",
    });
  });

  it("passes through 4xx errors thrown by plugins", async () => {
    app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/validated",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).toBeTruthy();
    expect(body.error).not.toContain("Internal server error.");
  });
});
