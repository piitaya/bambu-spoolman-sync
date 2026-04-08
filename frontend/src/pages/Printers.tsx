import {
  ActionIcon,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { IconEdit, IconGripVertical, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useConfig,
  useCreatePrinter,
  useDeletePrinter,
  useReorderPrinters,
  useUpdatePrinter
} from "../hooks";
import type { Printer, PrinterInput, PrinterPatch } from "../api";

type FormValues = PrinterInput;

const emptyValues: FormValues = {
  name: "",
  host: "",
  serial: "",
  access_code: "",
  enabled: true
};

interface RowProps {
  printer: Printer;
  onEdit: (p: Printer) => void;
  onDelete: (serial: string) => void;
  onToggleEnabled: (p: Printer, enabled: boolean) => void;
}

function SortablePrinterRow({
  printer: p,
  onEdit,
  onDelete,
  onToggleEnabled
}: RowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.serial });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    // Keep the dragged row above its neighbours so the shadow doesn't
    // get clipped by the following row during the lift.
    position: "relative",
    zIndex: isDragging ? 2 : undefined
  };

  return (
    <Table.Tr ref={setNodeRef} style={style}>
      <Table.Td style={{ width: 32 }}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("common.drag_handle")}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={16} />
        </ActionIcon>
      </Table.Td>
      <Table.Td>{p.name}</Table.Td>
      <Table.Td>{p.host}</Table.Td>
      <Table.Td>
        <Text ff="monospace" size="sm">
          {p.serial}
        </Text>
      </Table.Td>
      <Table.Td>
        <Switch
          checked={p.enabled}
          onChange={(e) => onToggleEnabled(p, e.currentTarget.checked)}
          aria-label={t("printers.columns.enabled")}
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            onClick={() => onEdit(p)}
            aria-label={t("common.edit")}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDelete(p.serial)}
            aria-label={t("common.delete")}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export default function PrintersPage() {
  const { data } = useConfig();
  const { t } = useTranslation();
  const create = useCreatePrinter();
  const update = useUpdatePrinter();
  const del = useDeletePrinter();
  const reorder = useReorderPrinters();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Printer | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const required = (v: string) =>
    v.trim() ? null : t("printers.form.required");

  const form = useForm<FormValues>({
    initialValues: emptyValues,
    validate: {
      name: required,
      host: required,
      serial: required,
      access_code: required
    }
  });

  useEffect(() => {
    if (opened) {
      form.setValues(editing ?? emptyValues);
      form.resetDirty(editing ?? emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing]);

  // Local mirror of the printer order for the DnD list. We keep it
  // out of the TanStack cache so dnd-kit's drop-settle animation
  // runs against a stable source of truth — a mid-animation cache
  // invalidation caused the dropped row to visibly jump.
  const remotePrinters = data?.config.printers ?? [];
  const [orderedPrinters, setOrderedPrinters] =
    useState<Printer[]>(remotePrinters);
  const remoteKey = useMemo(
    () => remotePrinters.map((p) => p.serial).join("|"),
    [remotePrinters]
  );
  useEffect(() => {
    // Only pull a new order from the server when the set of serials
    // actually changes (add / delete). Edits to fields don't matter
    // for ordering, so we merge fresh data onto the local order
    // instead of overwriting it mid-drag.
    setOrderedPrinters((prev) => {
      const prevKey = prev.map((p) => p.serial).join("|");
      if (prevKey === remoteKey) {
        // Same serials: keep our order, refresh the per-printer data.
        const bySerial = new Map(remotePrinters.map((p) => [p.serial, p]));
        return prev.map((p) => bySerial.get(p.serial) ?? p);
      }
      return remotePrinters;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey, remotePrinters]);

  const printers = orderedPrinters;
  const printerSerials = printers.map((p) => p.serial);

  const openNew = () => {
    setEditing(null);
    open();
  };
  const openEdit = (p: Printer) => {
    setEditing(p);
    open();
  };

  const submit = async (values: FormValues) => {
    try {
      if (editing) {
        // URL param identifies the printer as it currently is; the
        // patch body can include a new serial.
        const patch: PrinterPatch = { ...values };
        await update.mutateAsync({ serial: editing.serial, patch });
      } else {
        await create.mutateAsync(values);
      }
      close();
    } catch {
      // notification already surfaced by the hook's onError
    }
  };

  const toggleEnabled = (p: Printer, enabled: boolean) => {
    update.mutate({ serial: p.serial, patch: { enabled } });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const oldIndex = printers.findIndex((p) => p.serial === active.id);
    const newIndex = printers.findIndex((p) => p.serial === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(printers, oldIndex, newIndex);
    // Local state first (drives the visual settle animation), then
    // fire-and-forget the server sync.
    setOrderedPrinters(next);
    reorder.mutate({ ...data.config, printers: next });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t("printers.title")}</Title>
        <Button onClick={openNew}>{t("printers.add_printer")}</Button>
      </Group>

      {printers.length === 0 ? (
        <Text c="dimmed">{t("printers.none")}</Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                <Table.Th>{t("printers.columns.name")}</Table.Th>
                <Table.Th>{t("printers.columns.host")}</Table.Th>
                <Table.Th>{t("printers.columns.serial")}</Table.Th>
                <Table.Th>{t("printers.columns.enabled")}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <SortableContext
                items={printerSerials}
                strategy={verticalListSortingStrategy}
              >
                {printers.map((p) => (
                  <SortablePrinterRow
                    key={p.serial}
                    printer={p}
                    onEdit={openEdit}
                    onDelete={(serial) => del.mutate(serial)}
                    onToggleEnabled={toggleEnabled}
                  />
                ))}
              </SortableContext>
            </Table.Tbody>
          </Table>
        </DndContext>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title={editing ? t("printers.edit_printer") : t("printers.add_printer")}
        centered
      >
        <form onSubmit={form.onSubmit(submit)}>
          <Stack>
            <TextInput
              label={t("printers.form.name")}
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              label={t("printers.form.host")}
              placeholder={t("printers.form.host_placeholder")}
              required
              {...form.getInputProps("host")}
            />
            <TextInput
              label={t("printers.form.serial")}
              required
              {...form.getInputProps("serial")}
            />
            <PasswordInput
              label={t("printers.form.access_code")}
              required
              {...form.getInputProps("access_code")}
            />
            <Switch
              label={t("printers.form.enabled")}
              {...form.getInputProps("enabled", { type: "checkbox" })}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={create.isPending || update.isPending}
              >
                {t("common.save")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
