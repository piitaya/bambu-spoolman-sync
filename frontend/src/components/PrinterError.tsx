import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PrinterStatusCard } from "./PrinterStatusCard";
import type { PrinterErrorCode } from "../api";

/**
 * Printer-level error banner. Shares the `PrinterStatusCard` shell
 * with `PrinterEmptyState` so both status cards are visually a
 * family; only the icon, color and copy change.
 *
 * Title and description come from i18n keyed by `errorCode`. The
 * "other" branch falls back to showing the raw `message` so any
 * unclassified mqtt.js error is still readable to the user.
 */
export function PrinterError({
  errorCode,
  message
}: {
  errorCode: PrinterErrorCode | null;
  message: string;
}) {
  const { t } = useTranslation();
  const code: PrinterErrorCode = errorCode ?? "other";
  return (
    <PrinterStatusCard
      icon={<IconAlertTriangle size={18} stroke={1.8} />}
      color="red"
      title={t(`dashboard.errors.${code}.title`)}
      description={
        code === "other"
          ? message
          : t(`dashboard.errors.${code}.description`)
      }
    />
  );
}
