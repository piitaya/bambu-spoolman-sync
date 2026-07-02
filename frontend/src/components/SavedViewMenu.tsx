import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Radio,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconBookmark,
  IconBookmarkPlus,
  IconCheck,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { savedViewStatesEqual } from "../lib/savedViews";
import { ConfirmModal } from "./ConfirmModal";

interface SavedViewShape {
  id: string;
  name: string;
  state: unknown;
}

interface Props<P extends SavedViewShape> {
  views: readonly P[];
  currentState: unknown;
  busy?: boolean;
  onApply: (view: P) => void;
  onSave: (name: string) => void;
  /** Overwrites the view's state with the current filters. */
  onUpdate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function SavedViewMenu<P extends SavedViewShape>({
  views,
  currentState,
  busy,
  onApply,
  onSave,
  onUpdate,
  onRename,
  onDelete,
}: Props<P>) {
  const { t } = useTranslation();
  const [saveOpened, setSaveOpened] = useState(false);
  const [saveMode, setSaveMode] = useState<"update" | "new">("new");
  const [renaming, setRenaming] = useState<P | null>(null);
  const [deleting, setDeleting] = useState<P | null>(null);
  const [name, setName] = useState("");
  // Last applied view — the target of the "update" save choice.
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const hasActive = views.some((p) =>
    savedViewStatesEqual(p.state, currentState),
  );
  const current = views.find((p) => p.id === appliedId) ?? null;
  // No update offer when the filters already match a saved view exactly.
  const canUpdateCurrent =
    current !== null &&
    !hasActive &&
    !savedViewStatesEqual(current.state, currentState);
  // Falls back to "create" if the applied view is deleted remotely
  // while the modal is open.
  const updating = saveMode === "update" && canUpdateCurrent;

  const openSave = () => {
    setName("");
    setSaveMode(canUpdateCurrent ? "update" : "new");
    setSaveOpened(true);
  };

  const submitSave = () => {
    if (updating && current) {
      onUpdate(current.id);
    } else {
      const trimmed = name.trim();
      if (!trimmed) return;
      onSave(trimmed);
    }
    setSaveOpened(false);
  };

  const submitRename = () => {
    const trimmed = name.trim();
    if (!trimmed || !renaming) return;
    onRename(renaming.id, trimmed);
    setRenaming(null);
  };

  return (
    <>
      <Menu position="bottom-end" width={260}>
        <Menu.Target>
          <Tooltip label={t("views.label")}>
            <ActionIcon
              variant={hasActive ? "filled" : "default"}
              size="lg"
              aria-label={t("views.label")}
            >
              <IconBookmark size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("views.label")}</Menu.Label>
          {views.length === 0 && (
            <Menu.Item disabled>
              <Text size="xs" c="dimmed">
                {t("views.empty")}
              </Text>
            </Menu.Item>
          )}
          {views.map((view) => {
            const active = savedViewStatesEqual(view.state, currentState);
            return (
              <Menu.Item
                key={view.id}
                onClick={() => {
                  setAppliedId(view.id);
                  onApply(view);
                }}
                leftSection={
                  active ? (
                    <IconCheck size={14} />
                  ) : (
                    <span style={{ width: 14 }} />
                  )
                }
                rightSection={
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      component="div"
                      role="button"
                      tabIndex={0}
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label={t("views.rename")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setName(view.name);
                        setRenaming(view);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setName(view.name);
                          setRenaming(view);
                        }
                      }}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                    <ActionIcon
                      component="div"
                      role="button"
                      tabIndex={0}
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label={t("views.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(view);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleting(view);
                        }
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                }
              >
                <Text size="sm" truncate>
                  {view.name}
                </Text>
              </Menu.Item>
            );
          })}
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconBookmarkPlus size={14} />}
            onClick={openSave}
          >
            {t("views.save_current")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={saveOpened}
        onClose={() => setSaveOpened(false)}
        title={t("views.save_title")}
        centered
        size="sm"
      >
        <Stack>
          {canUpdateCurrent && current && (
            <Radio.Group
              value={saveMode}
              onChange={(v) => setSaveMode(v as "update" | "new")}
            >
              <Stack gap="xs">
                <Radio
                  value="update"
                  label={t("views.update_current", { name: current.name })}
                />
                <Radio value="new" label={t("views.create_new")} />
              </Stack>
            </Radio.Group>
          )}
          {!updating && (
            <TextInput
              label={t("views.name_label")}
              placeholder={t("views.name_placeholder")}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSave()}
              data-autofocus
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSaveOpened(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={busy}
              disabled={!updating && !name.trim()}
              onClick={submitSave}
            >
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t("views.rename")}
        centered
        size="sm"
      >
        <Stack>
          <TextInput
            label={t("views.name_label")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRenaming(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={busy}
              disabled={!name.trim()}
              onClick={submitRename}
            >
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            if (deleting.id === appliedId) setAppliedId(null);
            onDelete(deleting.id);
          }
          setDeleting(null);
        }}
        title={t("views.delete_confirm_title")}
        body={t("views.delete_confirm_body", {
          name: deleting?.name ?? "",
        })}
        loading={busy}
      />
    </>
  );
}
