import { Badge, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useMatchStatus, MATCH_STATUS_ORDER } from "./matchStatus";

export function StatusLegend({
  opened,
  onClose
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const matchStatus = useMatchStatus();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("status.legend_title")}
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("status.legend_intro")}
        </Text>
        {MATCH_STATUS_ORDER.map((type) => {
          const info = matchStatus[type];
          return (
            <Group key={type} align="center" wrap="nowrap" gap="md">
              <div
                style={{
                  width: 110,
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "flex-start"
                }}
              >
                <Badge color={info.color} variant="light">
                  {info.label}
                </Badge>
              </div>
              <Text size="sm" style={{ flex: 1 }}>
                {info.description}
              </Text>
            </Group>
          );
        })}
      </Stack>
    </Modal>
  );
}
