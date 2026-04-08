import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  FilamentsFileSchema,
  type FilamentEntry
} from "./matcher.js";
import { dataDir } from "./config.js";

export interface MappingOptions {
  url: string;
  cachePath: string;
  intervalHours: number;
  onError?: (err: unknown) => void;
}

export interface Mapping {
  readonly byId: Map<string, FilamentEntry>;
  readonly fetchedAt: Date | null;
  refresh(): Promise<number>;
  setInterval(hours: number): void;
  stop(): void;
}

export function mappingCachePath(): string {
  return resolve(dataDir(), "filaments.json");
}

/**
 * Creates a filament-mapping holder. On start, it loads any cached
 * filaments.json, then either immediately refetches (if the cache is
 * missing or stale) or schedules a refetch after the remaining TTL.
 */
export async function createMapping(opts: MappingOptions): Promise<Mapping> {
  let byId = new Map<string, FilamentEntry>();
  let fetchedAt: Date | null = null;
  let intervalHours = opts.intervalHours;
  let timer: NodeJS.Timeout | null = null;

  const parseAndSet = (raw: unknown) => {
    const parsed = FilamentsFileSchema.parse(raw);
    byId = new Map(parsed.map((e) => [e.id, e]));
    return parsed.length;
  };

  const loadCache = async (): Promise<Date | null> => {
    try {
      const raw = await readFile(opts.cachePath, "utf-8");
      parseAndSet(JSON.parse(raw));
      const s = await stat(opts.cachePath);
      return s.mtime;
    } catch {
      return null;
    }
  };

  const refresh = async (): Promise<number> => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(opts.url, { signal: ctrl.signal });
      if (!res.ok) {
        throw new Error(`mapping fetch ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const count = parseAndSet(json);
      fetchedAt = new Date();
      await mkdir(dirname(opts.cachePath), { recursive: true });
      await writeFile(opts.cachePath, JSON.stringify(json, null, 2), "utf-8");
      return count;
    } finally {
      clearTimeout(timeout);
    }
  };

  const scheduleNext = () => {
    if (timer) clearInterval(timer);
    const ms = intervalHours * 3_600_000;
    timer = setInterval(() => {
      refresh().catch((err) => opts.onError?.(err));
    }, ms);
    timer.unref?.();
  };

  const cachedAt = await loadCache();
  fetchedAt = cachedAt;
  const stale =
    !cachedAt || Date.now() - cachedAt.getTime() > intervalHours * 3_600_000;
  if (stale) {
    try {
      await refresh();
    } catch (err) {
      opts.onError?.(err);
    }
  }
  scheduleNext();

  return {
    get byId() {
      return byId;
    },
    get fetchedAt() {
      return fetchedAt;
    },
    refresh,
    setInterval(hours: number) {
      if (hours === intervalHours) return;
      intervalHours = hours;
      scheduleNext();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}
