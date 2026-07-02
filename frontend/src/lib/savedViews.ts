// Pure helpers for saved views (named toolbar states stored in the
// backend config). Each toolbar owns its state <-> view conversion.

interface SavedViewLike {
  id: string;
  name: string;
  state: unknown;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Arrays are set-like multi-select filters — order must not matter.
    return value
      .map(stable)
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Deep equality with key order ignored — detects the active saved view. */
export function savedViewStatesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

export function createSavedViewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function addSavedView<P extends SavedViewLike>(
  views: readonly P[],
  view: P,
): P[] {
  return [...views, view];
}

export function updateSavedView<P extends SavedViewLike>(
  views: readonly P[],
  id: string,
  state: P["state"],
): P[] {
  return views.map((p) => (p.id === id ? { ...p, state } : p));
}

/** Restore a stored value only if it's still a valid choice. */
export function memberOr<T extends string>(
  allowed: readonly T[],
  value: string,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function renameSavedView<P extends SavedViewLike>(
  views: readonly P[],
  id: string,
  name: string,
): P[] {
  return views.map((p) => (p.id === id ? { ...p, name } : p));
}

export function removeSavedView<P extends SavedViewLike>(
  views: readonly P[],
  id: string,
): P[] {
  return views.filter((p) => p.id !== id);
}
