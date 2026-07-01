import {
  Alert,
  CloseButton,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Spool } from "../api";
import { deriveOptions } from "../lib/toolbar/core";
import {
  clearSpoolFacets,
  DEFAULT_DIRECTION,
  SORT_FIELDS,
  SPOOL_GROUP_VALUES,
  spoolFacetCount,
  spoolFacetsAreActive,
  type SpoolFilters,
  type SpoolGroupBy,
  type SpoolSort,
  type SpoolStockLevel,
  type SpoolView,
} from "../lib/toolbar/spoolState";
import { FilterPanelCore } from "./toolbar/FilterPanelCore";
import { ToolbarShell } from "./toolbar/ToolbarShell";

// The pure state helpers (filters, sort, URL codec, grouping) live in
// lib/toolbar/spoolState; re-export them so existing imports keep working.
export * from "../lib/toolbar/spoolState";

interface PanelProps {
  spools: readonly Spool[];
  filters: SpoolFilters;
  onFiltersChange: (next: SpoolFilters) => void;
  sort: SpoolSort;
  onSortChange: (sort: SpoolSort) => void;
  groupBy: SpoolGroupBy;
  onGroupByChange: (group: SpoolGroupBy) => void;
}

/**
 * Stacked filter + sort controls. Used in the desktop sidebar
 * and inside the mobile drawer.
 */
export function SpoolFilterPanel({
  spools,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  groupBy,
  onGroupByChange,
}: PanelProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => deriveOptions(spools, filters.materials),
    [spools, filters.materials],
  );

  const update = <K extends keyof SpoolFilters>(
    key: K,
    value: SpoolFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  const changeMaterials = (next: string[]) => {
    if (next.length === 0) {
      onFiltersChange({ ...filters, materials: next });
      return;
    }
    const { products: valid, colorFamilies: validFams } = deriveOptions(
      spools,
      next,
    );
    const validProducts = new Set(valid);
    const validFamSet = new Set(validFams);
    onFiltersChange({
      ...filters,
      materials: next,
      products: filters.products.filter((p) => validProducts.has(p)),
      colorFamilies: filters.colorFamilies.filter((f) => validFamSet.has(f)),
    });
  };

  return (
    <FilterPanelCore
      i18nPrefix="spools"
      groupBy={groupBy}
      groupValues={SPOOL_GROUP_VALUES}
      onGroupByChange={onGroupByChange}
      sort={sort}
      sortFields={SORT_FIELDS}
      defaultDirections={DEFAULT_DIRECTION}
      onSortChange={onSortChange}
      options={options}
      selection={filters}
      onMaterialsChange={changeMaterials}
      onProductsChange={(v) => update("products", v)}
      onColorFamiliesChange={(v) => update("colorFamilies", v)}
      showClear={spoolFacetsAreActive(filters)}
      onClear={() => onFiltersChange(clearSpoolFacets(filters))}
      topSlot={
        filters.variantIds.length > 0 && (
          <Alert color="blue" variant="light" withCloseButton={false} p="xs">
            <Group
              justify="space-between"
              gap="xs"
              wrap="nowrap"
              align="center"
            >
              <Text size="xs">
                {t("spools.filters.variant_filter", {
                  ids: filters.variantIds.join(", "),
                })}
              </Text>
              <CloseButton
                size="sm"
                aria-label={t("common.clear")}
                onClick={() => update("variantIds", [])}
              />
            </Group>
          </Alert>
        )
      }
      bottomSlot={
        <>
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t("spools.filters.stock.label")}
            </Text>
            <SegmentedControl
              fullWidth
              value={filters.stock}
              onChange={(v) => update("stock", v as SpoolStockLevel)}
              data={[
                { value: "all", label: t("spools.filters.stock.all") },
                { value: "low", label: t("spools.filters.stock.low") },
                { value: "full", label: t("spools.filters.stock.full") },
              ]}
            />
          </Stack>
          <Switch
            label={t("spools.filters.ams_only")}
            checked={filters.amsOnly}
            onChange={(e) => update("amsOnly", e.currentTarget.checked)}
          />
          <Switch
            label={t("spools.filters.no_remain")}
            checked={filters.noRemain}
            onChange={(e) => update("noRemain", e.currentTarget.checked)}
          />
        </>
      }
    />
  );
}

interface Props extends PanelProps {
  loadedTags: ReadonlySet<string>;
  view: SpoolView;
  onViewChange: (view: SpoolView) => void;
}

export function SpoolToolbar(props: Props) {
  const { filters, onFiltersChange, view, onViewChange } = props;

  return (
    <ToolbarShell
      i18nPrefix="spools"
      search={filters.search}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      facetCount={spoolFacetCount(filters)}
      view={view}
      onViewChange={onViewChange}
      panel={
        <SpoolFilterPanel
          spools={props.spools}
          filters={filters}
          onFiltersChange={onFiltersChange}
          sort={props.sort}
          onSortChange={props.onSortChange}
          groupBy={props.groupBy}
          onGroupByChange={props.onGroupByChange}
        />
      }
    />
  );
}
