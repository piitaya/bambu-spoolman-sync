import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { HISTORY_FROM_ANCHOR, queryKeys } from "./queryKeys";

export const useConfig = () =>
  useQuery({ queryKey: queryKeys.config, queryFn: api.getConfig });

export const usePrinters = () =>
  useQuery({
    queryKey: queryKeys.printers,
    queryFn: api.getPrinters,
  });

export const useSpools = () =>
  useQuery({
    queryKey: queryKeys.spools,
    queryFn: api.listSpools,
  });

export const useSpoolHistory = (tagId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.spoolHistory.byTag(tagId ?? ""),
    queryFn: () => api.getSpoolHistory(tagId!, { from: HISTORY_FROM_ANCHOR }),
    enabled: Boolean(tagId),
    placeholderData: (prev) => prev,
  });

export const useFilamentCatalog = () =>
  useQuery({
    queryKey: queryKeys.filamentCatalog,
    queryFn: api.getFilamentCatalog,
  });

export const useFilamentCatalogEntries = () =>
  useQuery({
    queryKey: queryKeys.filamentCatalogEntries,
    queryFn: api.listFilamentCatalog,
  });
