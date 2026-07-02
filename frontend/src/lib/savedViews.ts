// Pure helpers for saved views: named, saved toolbar states persisted
// in the backend config (shared across devices via SSE). A saved view stores
// the structured toolbar state; each toolbar owns the conversion between
// its filter model and the stored shape, including graceful fallbacks
// for values that no longer exist.

interface SavedViewLike {
  id: string;
  name: string;
  state: unknown;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
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
  name: string,
  state: P["state"],
): P[] {
  return views.map((p) => (p.id === id ? { ...p, name, state } : p));
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
