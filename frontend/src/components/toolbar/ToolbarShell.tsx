import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  SegmentedControl,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconFilter,
  IconLayoutGrid,
  IconLayoutList,
  IconList,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../lib/breakpoints";
import type { ToolbarView } from "../../lib/toolbar/core";

interface Props {
  i18nPrefix: "spools" | "filaments";
  search: string;
  onSearchChange: (search: string) => void;
  facetCount: number;
  view: ToolbarView;
  onViewChange: (view: ToolbarView) => void;
  /** Filter panel rendered inside the mobile bottom drawer. */
  panel: ReactNode;
  /** Extra elements rendered in the toolbar row, after the search input. */
  actions?: ReactNode;
}

/**
 * Search input + (on mobile) a Filter button that opens a bottom
 * drawer containing the filter panel. On desktop, callers render
 * the panel separately in a sidebar.
 */
export function ToolbarShell({
  i18nPrefix,
  search,
  onSearchChange,
  facetCount,
  view,
  onViewChange,
  panel,
  actions,
}: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          leftSection={<IconSearch size={14} />}
          placeholder={t(`${i18nPrefix}.filters.search_placeholder`)}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          rightSection={
            search ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                color="gray"
                onClick={() => onSearchChange("")}
                aria-label={t("common.clear")}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          style={{ flex: 1 }}
        />
        {actions}
        {isMobile ? (
          <Button
            variant={facetCount > 0 ? "filled" : "default"}
            leftSection={<IconFilter size={14} />}
            onClick={open}
          >
            {facetCount > 0 ? (
              <Group gap={6} wrap="nowrap">
                {t(`${i18nPrefix}.filters.label`)}
                <Badge size="xs" color="gray" variant="white">
                  {facetCount}
                </Badge>
              </Group>
            ) : (
              t(`${i18nPrefix}.filters.label`)
            )}
          </Button>
        ) : (
          <SegmentedControl
            value={view}
            onChange={(v) => onViewChange(v as ToolbarView)}
            data={[
              {
                value: "table",
                label: (
                  <Tooltip label={t(`${i18nPrefix}.view.table`)}>
                    <IconLayoutList size={16} />
                  </Tooltip>
                ),
              },
              {
                value: "grid",
                label: (
                  <Tooltip label={t(`${i18nPrefix}.view.grid`)}>
                    <IconLayoutGrid size={16} />
                  </Tooltip>
                ),
              },
              {
                value: "list",
                label: (
                  <Tooltip label={t(`${i18nPrefix}.view.list`)}>
                    <IconList size={16} />
                  </Tooltip>
                ),
              },
            ]}
          />
        )}
      </Group>

      {isMobile && (
        <Drawer
          opened={opened}
          onClose={close}
          position="bottom"
          size="auto"
          title={t(`${i18nPrefix}.filters.label`)}
        >
          {panel}
        </Drawer>
      )}
    </>
  );
}
