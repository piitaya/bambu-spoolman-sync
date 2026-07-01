import { SegmentedControl, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogEntry } from "../api";
import { deriveOptions } from "../lib/toolbar/core";
import {
  clearFilamentFacets,
  DEFAULT_DIRECTION,
  FILAMENT_GROUP_VALUES,
  filamentFacetCount,
  filamentFacetsAreActive,
  SORT_FIELDS,
  type FilamentFilters,
  type FilamentGroupBy,
  type FilamentOwnershipFilter,
  type FilamentSort,
  type FilamentView,
} from "../lib/toolbar/filamentState";
import { FilterPanelCore } from "./toolbar/FilterPanelCore";
import { ToolbarShell } from "./toolbar/ToolbarShell";

// The pure state helpers (filters, sort, URL codec, aggregation) live in
// lib/toolbar/filamentState; re-export them so existing imports keep working.
export * from "../lib/toolbar/filamentState";

interface PanelProps {
  catalog: readonly CatalogEntry[];
  filters: FilamentFilters;
  onFiltersChange: (next: FilamentFilters) => void;
  sort: FilamentSort;
  onSortChange: (sort: FilamentSort) => void;
  groupBy: FilamentGroupBy;
  onGroupByChange: (group: FilamentGroupBy) => void;
}

export function FilamentFilterPanel({
  catalog,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  groupBy,
  onGroupByChange,
}: PanelProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => deriveOptions(catalog, filters.materials),
    [catalog, filters.materials],
  );

  const update = <K extends keyof FilamentFilters>(
    key: K,
    value: FilamentFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  const changeMaterials = (next: string[]) => {
    if (next.length === 0) {
      onFiltersChange({ ...filters, materials: next });
      return;
    }
    const { products: valid, colorFamilies: validFams } = deriveOptions(
      catalog,
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
      i18nPrefix="filaments"
      groupBy={groupBy}
      groupValues={FILAMENT_GROUP_VALUES}
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
      showClear={filamentFacetsAreActive(filters)}
      onClear={() => onFiltersChange(clearFilamentFacets(filters))}
      bottomSlot={
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            {t("filaments.filters.ownership.label")}
          </Text>
          <SegmentedControl
            fullWidth
            value={filters.ownership}
            onChange={(v) => update("ownership", v as FilamentOwnershipFilter)}
            data={[
              { value: "all", label: t("filaments.filters.ownership.all") },
              {
                value: "owned",
                label: t("filaments.filters.ownership.owned"),
              },
              {
                value: "not_owned",
                label: t("filaments.filters.ownership.not_owned"),
              },
            ]}
          />
        </Stack>
      }
    />
  );
}

interface Props extends PanelProps {
  view: FilamentView;
  onViewChange: (view: FilamentView) => void;
}

export function FilamentToolbar(props: Props) {
  const { filters, onFiltersChange, view, onViewChange } = props;

  return (
    <ToolbarShell
      i18nPrefix="filaments"
      search={filters.search}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      facetCount={filamentFacetCount(filters)}
      view={view}
      onViewChange={onViewChange}
      panel={
        <FilamentFilterPanel
          catalog={props.catalog}
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
