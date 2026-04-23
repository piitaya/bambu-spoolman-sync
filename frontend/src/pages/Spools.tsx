import {
  ActionIcon,
  Alert,
  Box,
  Card,
  ColorSwatch,
  Group,
  Loader,
  Menu,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconDots, IconGauge, IconTrash } from "@tabler/icons-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Spool } from "../api";
import {
  useLoadedTagIds,
  useRemoveSpool,
  useSpoolMap,
  useSpools,
} from "../hooks";
import { spoolFillColor } from "../components/spoolFillColor";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { AdjustRemainModal } from "../components/AdjustRemainModal";
import {
  applySpoolFilters,
  applySpoolSort,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  remainingGrams,
  SpoolFilterPanel,
  SpoolToolbar,
  type SpoolFilters,
  type SpoolSort,
  type SpoolSortField,
} from "../components/SpoolToolbar";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  return new Date(normalized).toLocaleString();
}

function formatGrams(grams: number | null): string {
  if (grams == null) return "—";
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}

// DataTable column accessors that map 1:1 with a SpoolSortField.
// Clicking a column header updates the shared SpoolSort state, and
// the Sort dropdown stays in sync.
const COLUMN_TO_SORT_FIELD: Record<string, SpoolSortField> = {
  color_name: "color_name",
  product: "product",
  material: "material",
  remain: "remain",
  remain_grams: "remain_grams",
  last_used: "last_used",
  last_updated: "last_updated",
};
const SORT_FIELD_TO_COLUMN: Partial<Record<SpoolSortField, string>> = {
  color_name: "color_name",
  product: "product",
  material: "material",
  remain: "remain",
  remain_grams: "remain_grams",
  last_used: "last_used",
  last_updated: "last_updated",
};

export default function SpoolsPage() {
  const { data: spools, isLoading, isError, error } = useSpools();
  const loadedTags = useLoadedTagIds();
  const removeSpool = useRemoveSpool();
  const { t } = useTranslation();
  const [filters, setFilters] = useState<SpoolFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SpoolSort>(DEFAULT_SORT);
  const [toRemove, setToRemove] = useState<Spool | null>(null);
  const [toAdjustId, setToAdjustId] = useState<string | null>(null);

  // Allow other pages to deep-link a spool by its tag id via navigation state.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const state = location.state as { selectTagId?: string } | null;
    if (state?.selectTagId) {
      navigate(`/inventory/${encodeURIComponent(state.selectTagId)}`, {
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spoolsByTagId = useSpoolMap();
  const toAdjust = toAdjustId ? spoolsByTagId.get(toAdjustId) ?? null : null;

  const filtered = useMemo(
    () => (spools ? applySpoolFilters(spools, filters, loadedTags) : []),
    [spools, filters, loadedTags],
  );

  const sorted = useMemo(
    () => applySpoolSort(filtered, sort),
    [filtered, sort],
  );

  const sortStatus: DataTableSortStatus<Spool> = {
    columnAccessor: SORT_FIELD_TO_COLUMN[sort.field] ?? "",
    direction: sort.direction,
  };

  const handleSortStatusChange = (status: DataTableSortStatus<Spool>) => {
    const field = COLUMN_TO_SORT_FIELD[status.columnAccessor as string];
    if (field) setSort({ field, direction: status.direction });
  };

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
        <EmptyStateCard description={t("spools.empty")} />
      ) : (
        <Group align="flex-start" gap="md" wrap="nowrap">
          <Box w={320} visibleFrom="sm" component="aside" style={{ flexShrink: 0 }}>
            <Card withBorder p="md" radius="md">
              <SpoolFilterPanel
                spools={spools}
                filters={filters}
                onFiltersChange={setFilters}
                sort={sort}
                onSortChange={setSort}
              />
            </Card>
          </Box>
          <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
            <SpoolToolbar
              spools={spools}
              loadedTags={loadedTags}
              filters={filters}
              onFiltersChange={setFilters}
              sort={sort}
              onSortChange={setSort}
            />
            {sorted.length === 0 ? (
              <EmptyStateCard description={t("spools.no_match")} />
            ) : (
            <DataTable
          withTableBorder
          highlightOnHover
          records={sorted}
          idAccessor="tag_id"
          sortStatus={sortStatus}
          onSortStatusChange={handleSortStatusChange}
          onRowClick={({ record }) => navigate(`/inventory/${encodeURIComponent(record.tag_id)}`)}
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
              width: 200,
              render: (spool) =>
                spool.remain != null ? (
                  <Group gap="xs" wrap="nowrap">
                    <Progress
                      value={spool.remain}
                      size="sm"
                      style={{ flex: 1 }}
                      color={spoolFillColor(spool.remain)}
                    />
                    <Text size="xs" w={64} ta="right">
                      {formatGrams(remainingGrams(spool))}
                    </Text>
                  </Group>
                ) : (
                  <Text c="dimmed" size="sm">—</Text>
                ),
            },
            {
              accessor: "last_used",
              title: t("spools.last_used"),
              sortable: true,
              render: (spool) => (
                <Text size="xs" c="dimmed">
                  {formatDate(spool.last_used)}
                </Text>
              ),
            },
            {
              accessor: "last_updated",
              title: t("spools.last_updated"),
              sortable: true,
              render: (spool) => (
                <Text size="xs" c="dimmed">
                  {formatDate(spool.last_updated)}
                </Text>
              ),
            },
            {
              accessor: "actions",
              title: "",
              width: 50,
              textAlign: "center",
              render: (spool) => (
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconGauge size={14} />}
                      onClick={(e) => { e.stopPropagation(); setToAdjustId(spool.tag_id); }}
                    >
                      {t("spools.adjust_remain")}
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={(e) => { e.stopPropagation(); setToRemove(spool); }}
                    >
                      {t("common.remove")}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ),
            },
          ]}
            />
            )}
          </Stack>
        </Group>
      )}

      {toAdjust && (
        <AdjustRemainModal
          key={toAdjust.tag_id}
          spool={toAdjust}
          opened
          onClose={() => setToAdjustId(null)}
        />
      )}

      <ConfirmModal
        opened={toRemove !== null}
        onClose={() => setToRemove(null)}
        onConfirm={() => {
          if (!toRemove) return;
          removeSpool.mutate(toRemove.tag_id, {
            onSettled: () => setToRemove(null),
          });
        }}
        title={t("spools.remove_confirm_title")}
        body={t("spools.remove_confirm_body", {
          name: toRemove?.color_name ?? toRemove?.tag_id,
        })}
        loading={removeSpool.isPending}
      />
    </Stack>
  );
}
