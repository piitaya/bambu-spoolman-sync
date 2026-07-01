import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

function mockFetch(response: {
  status: number;
  body?: string;
  statusText?: string;
}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

  it("sets the JSON content-type header when a body is sent", async () => {
    const fetchMock = mockFetch({ status: 200, body: "{}" });
    await api.putConfig({ printers: [] } as never);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
  });
});
