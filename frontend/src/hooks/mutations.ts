import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  api,
  ApiError,
  type Config,
  type PrinterConfig,
  type PrinterPatch,
} from "../api";
import { queryKeys } from "./queryKeys";
import { useMutationWithToast, useToasts } from "./useToasts";

// ---------------------------------------------------------------------------
// Printer mutations
// ---------------------------------------------------------------------------

function usePrinterConflictHandler() {
  const { t } = useTranslation();
  const toast = useToasts();
  return (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) {
      toast.error(new Error(t("printers.notifications.duplicate_serial")));
      return;
    }
    toast.error(err);
  };
}

export const useCreatePrinter = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: (input: PrinterConfig) => api.createPrinter(input),
    successMessage: t("printers.notifications.added"),
    invalidate: [queryKeys.config, queryKeys.printers],
    onError: usePrinterConflictHandler(),
  });
};

export const useUpdatePrinter = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: ({ serial, patch }: { serial: string; patch: PrinterPatch }) =>
      api.updatePrinter(serial, patch),
    successMessage: t("printers.notifications.updated"),
    invalidate: [queryKeys.config, queryKeys.printers],
    onError: usePrinterConflictHandler(),
  });
};

export const useRemovePrinter = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: (serial: string) => api.removePrinter(serial),
    successMessage: t("printers.notifications.removed"),
    invalidate: [queryKeys.config, queryKeys.printers],
  });
};

export const usePutConfig = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: (config: Config) => api.putConfig(config),
    successMessage: t("settings.saved"),
    invalidate: [queryKeys.config, queryKeys.printers],
  });
};

// ---------------------------------------------------------------------------
// Spool mutations
// ---------------------------------------------------------------------------

export const usePatchSpool = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: ({
      tagId,
      data,
    }: {
      tagId: string;
      data: { remain?: number };
    }) => api.patchSpool(tagId, data),
    successMessage: t("spools.notifications.updated"),
    invalidate: [queryKeys.spools, queryKeys.spoolHistory.all],
  });
};

export const useRemoveSpool = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: (tagId: string) => api.removeSpool(tagId),
    successMessage: t("spools.notifications.removed"),
    invalidate: [queryKeys.spools],
  });
};

export const usePatchHistoryEvent = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: ({
      tagId,
      eventId,
      data,
    }: {
      tagId: string;
      eventId: number;
      data: { remain: number | null };
    }) => api.patchHistoryEvent(tagId, eventId, data),
    successMessage: t("spool_detail.usage.manual.updated"),
    invalidate: [queryKeys.spoolHistory.all],
  });
};

export const useDeleteHistoryEvent = () => {
  const { t } = useTranslation();
  return useMutationWithToast({
    mutationFn: ({ tagId, eventId }: { tagId: string; eventId: number }) =>
      api.deleteHistoryEvent(tagId, eventId),
    successMessage: t("spool_detail.usage.manual.deleted"),
    invalidate: [queryKeys.spoolHistory.all],
  });
};

// ---------------------------------------------------------------------------
// Reorder — silent (no success toast, selective invalidation)
// ---------------------------------------------------------------------------

export const useReorderPrinters = () => {
  const qc = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (config: Config) => api.putConfig(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.printers });
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: queryKeys.config });
      toast.error(err);
    },
  });
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export const useRefreshMapping = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: () => api.refreshFilamentCatalog(),
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: queryKeys.printers });
      qc.invalidateQueries({ queryKey: queryKeys.filamentCatalog });
      qc.invalidateQueries({ queryKey: queryKeys.filamentCatalogEntries });
      toast.success(t("settings.mapping_card.refreshed", { count }));
    },
    onError: toast.error,
  });
};
