import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, AuthRequiredError, api, isAuthRequiredError } from "./api";

function mockFetch(response: {
  status: number;
  body?: string;
  statusText?: string;
  headers?: HeadersInit;
}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** `redirect: "manual"` yields a response no constructor can produce. */
function mockOpaqueRedirect() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ type: "opaqueredirect", status: 0, ok: false });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(() => null).catch((e: unknown) => e);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api request handling", () => {
  it("parses JSON on success", async () => {
    mockFetch({ status: 200, body: JSON.stringify([{ tag_id: "abc" }]) });
    await expect(api.listSpools()).resolves.toEqual([{ tag_id: "abc" }]);
  });

  it("returns undefined on 204", async () => {
    mockFetch({ status: 204 });
    await expect(api.removeSpool("abc")).resolves.toBeUndefined();
  });

  it("throws ApiError with message and code from the error envelope", async () => {
    mockFetch({
      status: 409,
      body: JSON.stringify({
        error: "Serial already exists.",
        code: "conflict",
      }),
    });
    const err = await api
      .createPrinter({} as never)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(409);
    expect(apiErr.message).toBe("Serial already exists.");
    expect(apiErr.code).toBe("conflict");
  });

  it("uses the raw body as message when the error body is not JSON", async () => {
    mockFetch({ status: 500, body: "boom" });
    const err = await api
      .getConfig()
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("boom");
  });

  it("falls back to statusText when the body is empty", async () => {
    mockFetch({ status: 502, statusText: "Bad Gateway" });
    const err = await api
      .getConfig()
      .then(() => null)
      .catch((e: unknown) => e);
    expect((err as ApiError).message).toBe("Bad Gateway");
  });

  it("does not let the browser chase an auth proxy's login redirect", async () => {
    const fetchMock = mockFetch({ status: 200, body: "{}" });
    await api.getConfig();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
  });

  it("sets the JSON content-type header when a body is sent", async () => {
    const fetchMock = mockFetch({ status: 200, body: "{}" });
    await api.putConfig({ printers: [] } as never);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
  });
});

// Pandaroo has no auth of its own: a login redirect, a 401/403 and an HTML
// body all mean the same thing — the proxy wants a new sign-in.
describe("auth proxy rejections", () => {
  it("reports an opaque redirect as an auth failure", async () => {
    mockOpaqueRedirect();
    const err = await caught(api.getPrinters());
    expect(err).toBeInstanceOf(AuthRequiredError);
    expect(isAuthRequiredError(err)).toBe(true);
  });

  it("reports a redirect status as an auth failure", async () => {
    mockFetch({ status: 302, headers: { location: "https://auth.example/" } });
    const err = await caught(api.getPrinters());
    expect(err).toBeInstanceOf(AuthRequiredError);
    expect((err as AuthRequiredError).status).toBe(302);
  });

  it.each([401, 403])("reports %i as an auth failure", async (status) => {
    mockFetch({ status, body: JSON.stringify({ error: "nope" }) });
    const err = await caught(api.listSpools());
    expect(err).toBeInstanceOf(AuthRequiredError);
    expect((err as AuthRequiredError).status).toBe(status);
    expect((err as AuthRequiredError).code).toBe("auth_required");
  });

  it("reports an HTML 200 as an auth failure rather than a JSON parse error", async () => {
    mockFetch({
      status: 200,
      body: "<!doctype html><title>Sign in</title>",
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const err = await caught(api.listSpools());
    expect(err).toBeInstanceOf(AuthRequiredError);
  });

  it("leaves a 304 alone", async () => {
    mockFetch({ status: 304 });
    const err = await caught(api.listSpools());
    expect(err).toBeInstanceOf(ApiError);
    expect(isAuthRequiredError(err)).toBe(false);
  });

  it("keeps ordinary API errors out of the auth path", async () => {
    mockFetch({ status: 409, body: JSON.stringify({ error: "conflict" }) });
    const err = await caught(api.createPrinter({} as never));
    expect(err).toBeInstanceOf(ApiError);
    expect(isAuthRequiredError(err)).toBe(false);
  });
});
