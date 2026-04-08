import { Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import type { MantineColor } from "@mantine/core";
import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  color: MantineColor;
  title: string;
  description: string;
}

/**
 * Shared shell for printer-level status banners (loading, error, …).
 * Same Card geometry as the slot cards so the whole dashboard speaks
 * one visual language; the children just swap the icon, title color,
 * and copy.
 */
export function PrinterStatusCard({ icon, color, title, description }: Props) {
  return (
    <Card withBorder shadow="sm" radius="md" padding="md">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <ThemeIcon
          variant="light"
          color={color}
          size={32}
          radius="xl"
          style={{ flexShrink: 0 }}
        >
          {icon}
        </ThemeIcon>
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} c={color === "gray" ? undefined : color}>
            {title}
          </Text>
          <Text size="sm" c="dimmed" style={{ wordBreak: "break-word" }}>
            {description}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}
