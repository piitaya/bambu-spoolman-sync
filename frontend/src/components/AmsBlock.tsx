import { Badge, Group, SimpleGrid, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { SlotCard, slotKey } from "./SlotCard";
import type { MatchedSlot } from "../api";

export interface AmsGroup {
  id: number;
  label: string;
  /** 0 = right, 1 = left, null = single-nozzle (no badge). */
  nozzleId: number | null;
  slots: MatchedSlot[];
}

/**
 * Label an AMS by its raw `id`, bambuddy-style:
 *   0..3   → "AMS A", "AMS B", "AMS C", "AMS D"
 *   128..  → "AMS HT-A", "AMS HT-B", … (up to 8 HTs)
 *
 * The "AMS" prefix is intentionally not localized — it's a Bambu
 * product name, not a translatable noun.
 */
export function amsLabel(id: number): string {
  if (id >= 128) {
    return `AMS HT-${String.fromCharCode(65 + (id - 128))}`;
  }
  return `AMS ${String.fromCharCode(65 + id)}`;
}

function NozzleBadge({ nozzleId }: { nozzleId: number | null }) {
  const { t } = useTranslation();
  if (nozzleId == null) return null;
  const label =
    nozzleId === 1 ? t("common.left_nozzle") : t("common.right_nozzle");
  const color = nozzleId === 1 ? "grape" : "blue";
  return (
    <Badge size="sm" color={color} variant="light">
      {label}
    </Badge>
  );
}

export function AmsBlock({ group }: { group: AmsGroup }) {
  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Title order={5} c="dimmed" tt="uppercase" fz="xs">
          {group.label}
        </Title>
        <NozzleBadge nozzleId={group.nozzleId} />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {group.slots.map((s) => (
          <SlotCard key={slotKey(s)} s={s} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
