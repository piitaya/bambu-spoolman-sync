const SPOOL_HISTORY_ROOT = ["spool-history"] as const;

export const queryKeys = {
  config: ["config"] as const,
  printers: ["printers"] as const,
  spools: ["spools"] as const,
  filamentCatalog: ["filament-catalog"] as const,
  filamentCatalogEntries: ["filament-catalog", "entries"] as const,
  spoolHistory: {
    all: SPOOL_HISTORY_ROOT,
    byTag: (tagId: string) => [...SPOOL_HISTORY_ROOT, tagId] as const,
  },
};

// Fixed anchor: ask the backend for every event ever recorded for this tag.
// Keeps the query key stable and avoids first_seen/millisecond-precision
// mismatches where the first event could slip under `gte`.
export const HISTORY_FROM_ANCHOR = "1970-01-01T00:00:00.000Z";
