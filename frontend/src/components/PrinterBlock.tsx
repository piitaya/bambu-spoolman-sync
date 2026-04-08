import { Stack, Title } from "@mantine/core";
import { AmsBlock, amsLabel, type AmsGroup } from "./AmsBlock";
import { PrinterEmptyState } from "./PrinterEmptyState";
import { PrinterError } from "./PrinterError";
import type { MatchedSlot, PrinterStateView } from "../api";

/**
 * Bucket slots by AMS unit, sort each group's slots, and label the
 * group with bambuddy's naming convention (see `amsLabel`). On a
 * dual-nozzle printer we also tag each group with its nozzle so the
 * UI can render a small badge — no extra section wrapper needed.
 */
function groupByAms(slots: MatchedSlot[]): AmsGroup[] {
  const showNozzle = slots.some((s) => s.slot.nozzle_id === 1);
  const groups = new Map<number, MatchedSlot[]>();
  for (const s of slots) {
    const arr = groups.get(s.slot.ams_id);
    if (arr) arr.push(s);
    else groups.set(s.slot.ams_id, [s]);
  }
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => {
      const na = a[0].slot.nozzle_id ?? 0;
      const nb = b[0].slot.nozzle_id ?? 0;
      if (na !== nb) return na - nb;
      return a[0].slot.ams_id - b[0].slot.ams_id;
    })
    .map(([id, items]) => {
      items.sort((a, b) => a.slot.slot_id - b.slot.slot_id);
      return {
        id,
        label: amsLabel(id),
        nozzleId: showNozzle ? (items[0].slot.nozzle_id ?? 0) : null,
        slots: items
      };
    });
}

export function PrinterBlock({ p }: { p: PrinterStateView }) {
  const groups = groupByAms(p.slots);
  return (
    <Stack gap="md">
      <Title order={4}>{p.name}</Title>
      {p.status.errorCode != null ? (
        <PrinterError
          errorCode={p.status.errorCode}
          message={p.status.lastError ?? ""}
        />
      ) : groups.length === 0 ? (
        <PrinterEmptyState />
      ) : (
        groups.map((g) => <AmsBlock key={g.id} group={g} />)
      )}
    </Stack>
  );
}
