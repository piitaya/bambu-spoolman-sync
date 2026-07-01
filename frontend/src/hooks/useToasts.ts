import { notifications } from "@mantine/notifications";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export function useToasts() {
  const { t } = useTranslation();
  return {
    success: (message: string) =>
      notifications.show({ color: "green", message }),
    error: (err: unknown) =>
      notifications.show({
        color: "red",
        title: t("errors.generic"),
        message: err instanceof Error ? err.message : String(err),
      }),
  };
}

// Mutation factory — eliminates toast/invalidation boilerplate.
export function useMutationWithToast<TData, TVariables>(opts: {
  mutationFn: (vars: TVariables) => Promise<TData>;
  successMessage: string;
  invalidate?: readonly QueryKey[];
  onError?: (err: unknown) => void;
}) {
  const qc = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: opts.mutationFn,
    onSuccess: () => {
      for (const key of opts.invalidate ?? []) {
        qc.invalidateQueries({ queryKey: key });
      }
      toast.success(opts.successMessage);
    },
    onError: opts.onError ?? toast.error,
  });
}
