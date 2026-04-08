import { ActionIcon, Alert, Group, Loader, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHelp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PrinterBlock } from "../components/PrinterBlock";
import { StatusLegend } from "../components/StatusLegend";
import { useAppState } from "../hooks";

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useAppState();
  const { t } = useTranslation();
  const [legendOpened, { open: openLegend, close: closeLegend }] =
    useDisclosure(false);

  if (isLoading) return <Loader />;
  if (isError) {
    return (
      <Alert color="red" title={t("dashboard.failed_to_load")}>
        {error instanceof Error ? error.message : String(error)}
      </Alert>
    );
  }

  const printers = (data?.printers ?? []).filter((p) => p.enabled);

  return (
    <Stack gap="xl">
      <Group gap="xs">
        <Title order={2}>{t("dashboard.title")}</Title>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={openLegend}
          aria-label={t("dashboard.help_aria_label")}
        >
          <IconHelp size={20} />
        </ActionIcon>
      </Group>

      {printers.length === 0 && (
        <Alert color="blue" title={t("dashboard.no_printers_title")}>
          {t("dashboard.no_printers_body")}
        </Alert>
      )}

      {printers.map((p) => (
        <PrinterBlock key={p.serial} p={p} />
      ))}

      <StatusLegend opened={legendOpened} onClose={closeLegend} />
    </Stack>
  );
}
