import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "./queryKeys";

export function useEventStream() {
  const qc = useQueryClient();
  useEffect(() => {
    const source = new EventSource("/api/events");
    // On (re)connect, re-sync the live-data queries to cover anything missed
    // while the stream was down. Scoped to avoid nuking unrelated caches.
    source.addEventListener("connected", () => {
      qc.invalidateQueries({ queryKey: queryKeys.printers });
      qc.invalidateQueries({ queryKey: queryKeys.spools });
      qc.invalidateQueries({ queryKey: queryKeys.spoolHistory.all });
      qc.invalidateQueries({ queryKey: queryKeys.config });
    });
    source.addEventListener("printers-changed", () => {
      qc.invalidateQueries({ queryKey: queryKeys.printers });
    });
    source.addEventListener("spools-changed", (e) => {
      qc.invalidateQueries({ queryKey: queryKeys.spools });
      try {
        const { tag_id } = JSON.parse((e as MessageEvent).data);
        if (tag_id) {
          qc.invalidateQueries({
            queryKey: queryKeys.spoolHistory.byTag(tag_id),
          });
        }
      } catch {}
    });
    source.addEventListener("config-changed", () => {
      qc.invalidateQueries({ queryKey: queryKeys.config });
      qc.invalidateQueries({ queryKey: queryKeys.printers });
    });
    return () => source.close();
  }, [qc]);
}
