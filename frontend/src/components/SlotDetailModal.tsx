import {
  ActionIcon,
  Badge,
  CopyButton,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { amsLabel } from "./AmsBlock";
import { useMatchStatus } from "./matchStatus";
import type { MatchedSlot } from "../api";

function Row({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Table.Tr>
      <Table.Td style={{ width: 120, verticalAlign: "top" }}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Table.Td>
      <Table.Td style={{ minWidth: 0 }}>{value}</Table.Td>
    </Table.Tr>
  );
}

function Plain({ children }: { children: React.ReactNode }) {
  return (
    <Text size="sm" truncate>
      {children}
    </Text>
  );
}

function CopyableMono({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
      <Text ff="monospace" size="sm" truncate style={{ flex: 1, minWidth: 0 }}>
        {value}
      </Text>
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip
            label={copied ? t("common.copied") : t("common.copy")}
            withArrow
            position="left"
          >
            <ActionIcon
              size="sm"
              variant="subtle"
              color={copied ? "teal" : "gray"}
              onClick={copy}
              aria-label={t("common.copy")}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

export function SlotDetailModal({
  slot,
  opened,
  onClose
}: {
  slot: MatchedSlot;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const matchStatus = useMatchStatus();
  const s = slot.slot;
  const slotName = t("slot.label", { n: s.slot_id + 1 });
  const title = `${amsLabel(s.ams_id)} · ${slotName}`;
  const nozzle =
    s.nozzle_id == null
      ? null
      : s.nozzle_id === 1
        ? t("common.left_nozzle")
        : t("common.right_nozzle");
  const hasTemp = s.nozzle_temp_min != null || s.nozzle_temp_max != null;
  const status = matchStatus[slot.type];

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md" centered>
      <Stack gap="md">
        <Group gap="xs">
          <Badge color={status.color} variant="light">
            {status.label}
          </Badge>
          {nozzle && (
            <Badge
              color={s.nozzle_id === 1 ? "grape" : "blue"}
              variant="light"
            >
              {nozzle}
            </Badge>
          )}
        </Group>

        <Table layout="fixed" withRowBorders>
          <Table.Tbody>
            {slot.entry?.color_name && (
              <Row
                label={t("slot.fields.color")}
                value={<Plain>{slot.entry.color_name}</Plain>}
              />
            )}
            <Row
              label={t("slot.fields.material")}
              value={
                <Plain>{s.tray_sub_brands ?? s.tray_type ?? "—"}</Plain>
              }
            />
            {s.tray_id_name && (
              <Row
                label={t("slot.fields.variant_id")}
                value={<CopyableMono value={s.tray_id_name} />}
              />
            )}
            {slot.entry?.spoolman_id && (
              <Row
                label={t("slot.fields.spoolman_id")}
                value={<CopyableMono value={slot.entry.spoolman_id} />}
              />
            )}
            {s.tray_color && (
              <Row
                label={t("slot.fields.color_hex")}
                value={<CopyableMono value={s.tray_color} />}
              />
            )}
            {hasTemp && (
              <Row
                label={t("slot.fields.nozzle_temp")}
                value={
                  <Plain>
                    {s.nozzle_temp_min ?? "—"} – {s.nozzle_temp_max ?? "—"} °C
                  </Plain>
                }
              />
            )}
            {s.tray_weight && (
              <Row
                label={t("slot.fields.spool_weight")}
                value={<Plain>{s.tray_weight} g</Plain>}
              />
            )}
            {s.remain != null && (
              <Row
                label={t("slot.fields.remaining")}
                value={<Plain>{s.remain}%</Plain>}
              />
            )}
            {s.tray_uuid && (
              <Row
                label={t("slot.fields.tray_uuid")}
                value={<CopyableMono value={s.tray_uuid} />}
              />
            )}
            <Row
              label={t("slot.fields.printer")}
              value={<CopyableMono value={s.printer_serial} />}
            />
          </Table.Tbody>
        </Table>
      </Stack>
    </Modal>
  );
}
