import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let reload: ReturnType<typeof vi.fn>;

// `session.ts` remembers its last reload in module scope, so each test gets a
// fresh copy — along with a fresh `api` so `instanceof` still lines up.
async function load() {
  vi.resetModules();
  const [session, api] = await Promise.all([
    import("./session"),
    import("../api"),
  ]);
  return { ...session, ...api };
}

beforeEach(() => {
  reload = vi.fn();
  vi.stubGlobal("window", { location: { reload } });
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reload on a proxy rejection", () => {
  it("reloads so the proxy can send the user to its login page", async () => {
    const { noteAuthFailure, AuthRequiredError } = await load();
    noteAuthFailure(new AuthRequiredError(401));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores failures that are not the proxy turning us away", async () => {
    const { noteAuthFailure, ApiError } = await load();
    noteAuthFailure(new ApiError(500, "boom"));
    noteAuthFailure(new TypeError("Failed to fetch"));
    noteAuthFailure(undefined);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once for a burst of failing requests", async () => {
    const { noteAuthFailure, AuthRequiredError } = await load();
    noteAuthFailure(new AuthRequiredError(401));
    noteAuthFailure(new AuthRequiredError(403));
    noteAuthFailure(new AuthRequiredError(302));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // A proxy that serves the page but forbids /api would loop forever.
  it("does not reload again within the cooldown", async () => {
    const { noteAuthFailure, AuthRequiredError } = await load();
    noteAuthFailure(new AuthRequiredError(401));
    vi.advanceTimersByTime(59_000);
    noteAuthFailure(new AuthRequiredError(401));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("tries again once the cooldown has passed", async () => {
    const { noteAuthFailure, AuthRequiredError } = await load();
    noteAuthFailure(new AuthRequiredError(401));
    vi.advanceTimersByTime(61_000);
    noteAuthFailure(new AuthRequiredError(401));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("still guards when session storage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    const { noteAuthFailure, AuthRequiredError } = await load();
    noteAuthFailure(new AuthRequiredError(401));
    noteAuthFailure(new AuthRequiredError(401));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
