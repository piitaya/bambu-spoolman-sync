import {
  Alert,
  Badge,
  Card,
  ColorSwatch,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalSpool } from "../api";
import { useSpools } from "../hooks";

function formatDate(iso: string): string {
  return new Date(iso + "Z").toLocaleString();
}

function sortData(data: LocalSpool[], { columnAccessor, direction }: DataTableSortStatus<LocalSpool>): LocalSpool[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[columnAccessor as keyof LocalSpool];
    const bVal = b[columnAccessor as keyof LocalSpool];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
    return String(aVal).localeCompare(String(bVal));
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export default function SpoolsPage() {
  const { data: spools, isLoading, isError, error } = useSpools();
  const { t } = useTranslation();
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<LocalSpool>>({
    columnAccessor: "last_seen",
    direction: "desc",
  });

  const sorted = useMemo(
    () => (spools ? sortData(spools, sortStatus) : []),
    [spools, sortStatus],
  );

  if (isLoading) return <Loader />;
  if (isError) {
    return (
      <Alert color="red" title={t("spools.failed_to_load")}>
        {error instanceof Error ? error.message : String(error)}
      </Alert>
    );
  }

  return (
    <Stack gap="xl">
      <Title order={2}>{t("spools.title")}</Title>

      {(!spools || spools.length === 0) ? (
        <Card withBorder padding="xl" radius="md">
          <Stack gap="md" align="center" ta="center">
            <Text c="dimmed" maw={420}>
              {t("spools.empty")}
            </Text>
          </Stack>
        </Card>
      ) : (
        <DataTable
          withTableBorder
          highlightOnHover
          records={sorted}
          idAccessor="id"
          sortStatus={sortStatus}
          onSortStatusChange={setSortStatus}
          columns={[
            {
              accessor: "color_hex",
              title: t("slot.fields.color"),
              sortable: false,
              render: (spool) =>
                spool.color_hex ? (
                  <ColorSwatch color={`#${spool.color_hex}`} size={24} />
                ) : (
                  <Text c="dimmed" size="sm">—</Text>
                ),
            },
            {
              accessor: "color_name",
              title: t("slot.fields.color_name"),
              sortable: true,
              render: (spool) => (
                <Text size="sm" fw={500}>
                  {spool.color_name ?? "—"}
                </Text>
              ),
            },
            {
              accessor: "product",
              title: t("slot.fields.bambu_filament"),
              sortable: true,
              render: (spool) => (
                <Text size="sm">
                  {spool.product ?? "—"}
                </Text>
              ),
            },
            {
              accessor: "material",
              title: t("slot.fields.material"),
              sortable: true,
            },
            {
              accessor: "remain",
              title: t("slot.fields.remaining"),
              sortable: true,
              width: 160,
              render: (spool) =>
                spool.remain != null ? (
                  <Group gap="xs" wrap="nowrap">
                    <Progress
                      value={spool.remain}
                      size="sm"
                      style={{ flex: 1 }}
                      color={
                        spool.remain > 25
                          ? "teal"
                          : spool.remain > 10
                            ? "yellow"
                            : "red"
                      }
                    />
                    <Text size="xs" c="dimmed" w={36} ta="right">
                      {spool.remain}%
                    </Text>
                  </Group>
                ) : (
                  <Text c="dimmed" size="sm">—</Text>
                ),
            },
            {
              accessor: "source",
              title: t("slot.sections.source"),
              sortable: true,
              render: (spool) => (
                <Badge
                  variant="light"
                  color={spool.source === "scan" ? "blue" : "gray"}
                  size="sm"
                >
                  {t(`spools.source_${spool.source}`)}
                </Badge>
              ),
            },
            {
              accessor: "last_seen",
              title: t("spools.last_seen"),
              sortable: true,
              render: (spool) => (
                <Text size="xs" c="dimmed">
                  {formatDate(spool.last_seen)}
                </Text>
              ),
            },
          ]}
        />
      )}
    </Stack>
  );
}
