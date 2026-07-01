import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Tooltip,
} from "@mantine/core";
import { IconSortAscending, IconSortDescending } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FAMILY_HEX, type ColorFamily } from "../../lib/colorFamily";
import type { FacetOptions, SortState } from "../../lib/toolbar/core";
import { ColorSwatch } from "../ColorSwatch";
import { PillPicker } from "../PillPicker";

interface FacetSelection {
  materials: string[];
  products: string[];
  colorFamilies: ColorFamily[];
}

interface Props<F extends string, G extends string> {
  i18nPrefix: "spools" | "filaments";
  groupBy: G;
  groupValues: readonly G[];
  onGroupByChange: (group: G) => void;
  sort: SortState<F>;
  sortFields: readonly F[];
  defaultDirections: Record<F, "asc" | "desc">;
  onSortChange: (sort: SortState<F>) => void;
  options: FacetOptions;
  selection: FacetSelection;
  onMaterialsChange: (materials: string[]) => void;
  onProductsChange: (products: string[]) => void;
  onColorFamiliesChange: (families: ColorFamily[]) => void;
  showClear: boolean;
  onClear: () => void;
  /** Rendered above the group-by select (e.g. the variant filter alert). */
  topSlot?: ReactNode;
  /** Rendered between the pickers and the clear button (domain controls). */
  bottomSlot?: ReactNode;
}

/**
 * The stacked group-by / sort / facet-picker controls shared by the
 * spool and filament filter panels. Domain-specific controls plug into
 * `topSlot` / `bottomSlot`.
 */
export function FilterPanelCore<F extends string, G extends string>({
  i18nPrefix,
  groupBy,
  groupValues,
  onGroupByChange,
  sort,
  sortFields,
  defaultDirections,
  onSortChange,
  options,
  selection,
  onMaterialsChange,
  onProductsChange,
  onColorFamiliesChange,
  showClear,
  onClear,
  topSlot,
  bottomSlot,
}: Props<F, G>) {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      {topSlot}
      <Select
        label={t("common.group_by")}
        data={groupValues.map((v) => ({
          value: v,
          label: t(`${i18nPrefix}.group.${v}`),
        }))}
        value={groupBy}
        onChange={(v) => v && onGroupByChange(v as G)}
        allowDeselect={false}
      />
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <Select
          label={t(`${i18nPrefix}.sort.label`)}
          data={sortFields.map((f) => ({
            value: f,
            label: t(`${i18nPrefix}.sort.${f}`),
          }))}
          value={sort.field}
          onChange={(v) => {
            if (!v) return;
            const field = v as F;
            onSortChange({ field, direction: defaultDirections[field] });
          }}
          allowDeselect={false}
          style={{ flex: 1 }}
        />
        <Tooltip
          label={t(
            `${i18nPrefix}.sort.direction.${sort.direction === "asc" ? "asc" : "desc"}`,
          )}
        >
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() =>
              onSortChange({
                ...sort,
                direction: sort.direction === "asc" ? "desc" : "asc",
              })
            }
            aria-label={t(`${i18nPrefix}.sort.toggle_direction`)}
          >
            {sort.direction === "asc" ? (
              <IconSortAscending size={16} />
            ) : (
              <IconSortDescending size={16} />
            )}
          </ActionIcon>
        </Tooltip>
      </Group>
      <PillPicker<string>
        label={t(`${i18nPrefix}.filters.material`)}
        placeholder={t(`${i18nPrefix}.filters.material_placeholder`)}
        value={selection.materials}
        onChange={onMaterialsChange}
        options={options.materials}
        getLabel={(v) => v}
      />
      <PillPicker<string>
        label={t(`${i18nPrefix}.filters.product`)}
        placeholder={t(`${i18nPrefix}.filters.product_placeholder`)}
        value={selection.products}
        onChange={onProductsChange}
        options={options.products}
        getLabel={(v) => v}
      />
      <PillPicker<ColorFamily>
        label={t(`${i18nPrefix}.filters.color_family`)}
        placeholder={t(`${i18nPrefix}.filters.color_family_placeholder`)}
        value={selection.colorFamilies}
        onChange={onColorFamiliesChange}
        options={options.colorFamilies}
        getLabel={(v) => t(`color_family.${v}`)}
        renderAdornment={(v) => (
          <ColorSwatch hexes={[FAMILY_HEX[v]]} size={12} />
        )}
      />
      {bottomSlot}
      {showClear && (
        <Button variant="subtle" color="gray" size="xs" onClick={onClear}>
          {t(`${i18nPrefix}.filters.clear`)}
        </Button>
      )}
    </Stack>
  );
}
