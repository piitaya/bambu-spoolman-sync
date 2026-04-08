import { Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { PrinterStatusCard } from "./PrinterStatusCard";

/**
 * Loading state shown when a printer has no AMS slot data yet and
 * no concrete error to report. Shares the `PrinterStatusCard` shell
 * with `PrinterError` so the two states are visually a family.
 */
export function PrinterEmptyState() {
  const { t } = useTranslation();
  return (
    <PrinterStatusCard
      icon={<Loader size={16} color="gray" />}
      color="gray"
      title={t("dashboard.empty.title")}
      description={t("dashboard.empty.body")}
    />
  );
}
