import { isAuthRequiredError } from "../api";

const RELOAD_KEY = "pandaroo.auth-reload";
const RELOAD_COOLDOWN_MS = 60_000;

// Mirrors the stored timestamp so a burst of requests failing in the same tick
// triggers one reload, storage or not.
let lastReload = 0;

function readLastReload(): number {
  try {
    return Math.max(
      lastReload,
      Number(sessionStorage.getItem(RELOAD_KEY)) || 0,
    );
  } catch {
    return lastReload;
  }
}

function rememberReload(at: number): void {
  lastReload = at;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(at));
  } catch {
    // Private mode: the in-memory copy is all we get.
  }
}

/**
 * Reload the page when the reverse proxy in front of Pandaroo stops accepting
 * our requests. A background request cannot follow the proxy's redirect to a
 * login page, a navigation can — so the reload is what puts the user in front
 * of it.
 *
 * At most once per cooldown: a proxy that serves the page but forbids `/api`
 * would otherwise reload forever.
 */
export function noteAuthFailure(err: unknown): void {
  if (!isAuthRequiredError(err)) return;
  const now = Date.now();
  if (now - readLastReload() < RELOAD_COOLDOWN_MS) return;
  rememberReload(now);
  window.location.reload();
}
