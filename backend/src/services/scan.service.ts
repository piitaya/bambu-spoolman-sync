import type { Spool } from "../domain/spool.js";
import { matchSpool, type FilamentEntry, type MatchType } from "../domain/matcher.js";
import {
  createSpoolmanClient,
  decodeExtraString,
  type SpoolmanClient,
} from "../clients/spoolman.client.js";

export interface ScanResult {
  spool: Spool;
  match: MatchType;
  sync_available: boolean;
  synced: boolean;
  archived: boolean;
}

export async function scanSpool(
  spool: Spool,
  mapping: Map<string, FilamentEntry>,
  spoolmanUrl?: string,
  clientFactory: (url: string) => SpoolmanClient = createSpoolmanClient,
): Promise<ScanResult> {
  const match = matchSpool(spool, mapping);
  let enrichedSpool = spool;
  let synced = false;
  let archived = false;

  if (spoolmanUrl && spool.uid) {
    try {
      const client = clientFactory(spoolmanUrl);
      const all = await client.listSpools();
      const found = all.find(
        (s) => decodeExtraString(s.extra?.tag) === spool.uid,
      );
      if (found) {
        synced = true;
        archived = found.archived ?? false;
        if (found.used_weight != null && spool.weight != null) {
          const total = spool.weight;
          const remaining = Math.max(0, total - found.used_weight);
          enrichedSpool = {
            ...spool,
            remain: total > 0 ? Math.round((remaining / total) * 100) : 0,
          };
        }
      }
    } catch {
      // Spoolman unreachable — continue without weight enrichment
    }
  }

  return {
    spool: enrichedSpool,
    match: match.type,
    sync_available: !!spoolmanUrl,
    synced,
    archived,
  };
}
