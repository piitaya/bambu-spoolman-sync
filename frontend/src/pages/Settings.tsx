import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useAppState,
  useConfig,
  usePutConfig,
  useRefreshMapping
} from "../hooks";
import { LANGUAGES, persistLanguage, type Language } from "../i18n";

interface FormValues {
  refresh_interval_hours: number;
}

const REPO_LABEL = "piitaya/bambu-spoolman-db";

export default function SettingsPage() {
  const { data } = useConfig();
  const { data: state } = useAppState();
  const put = usePutConfig();
  const refresh = useRefreshMapping();
  const { t, i18n } = useTranslation();

  const form = useForm<FormValues>({
    initialValues: { refresh_interval_hours: 24 }
  });

  useEffect(() => {
    if (data?.config.mapping) {
      form.setValues({
        refresh_interval_hours: data.config.mapping.refresh_interval_hours
      });
      form.resetDirty({
        refresh_interval_hours: data.config.mapping.refresh_interval_hours
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config.mapping.refresh_interval_hours]);

  const save = async (values: FormValues) => {
    if (!data) return;
    await put.mutateAsync({
      ...data.config,
      mapping: {
        ...data.config.mapping,
        refresh_interval_hours: values.refresh_interval_hours
      }
    });
  };

  const fetchedAt = state?.mapping.fetched_at
    ? new Date(state.mapping.fetched_at).toLocaleString()
    : t("settings.mapping_card.never");

  const languageOptions = useMemo(
    () =>
      Object.entries(LANGUAGES).map(([value, info]) => ({
        value,
        label: info.label
      })),
    []
  );

  const onLanguageChange = (value: string | null) => {
    if (!value || !(value in LANGUAGES)) return;
    const lang = value as Language;
    i18n.changeLanguage(lang);
    persistLanguage(lang);
  };

  return (
    <Stack gap="lg" maw={640}>
      <Title order={2}>{t("settings.title")}</Title>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Title order={4}>{t("settings.language_card.title")}</Title>
          <Select
            label={t("settings.language_card.label")}
            value={i18n.language in LANGUAGES ? i18n.language : "en"}
            onChange={onLanguageChange}
            data={languageOptions}
            allowDeselect={false}
          />
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Title order={4}>{t("settings.mapping_card.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("settings.mapping_card.source_hint", { repo: REPO_LABEL })}
            <br />
            {t("settings.mapping_card.last_fetched", {
              when: fetchedAt,
              count: state?.mapping.count ?? 0
            })}
          </Text>
          <form onSubmit={form.onSubmit(save)}>
            <Stack>
              <NumberInput
                label={t("settings.mapping_card.refresh_interval")}
                min={1}
                max={168}
                {...form.getInputProps("refresh_interval_hours")}
              />
              <Group>
                <Button type="submit" loading={put.isPending}>
                  {t("common.save")}
                </Button>
                <Button
                  variant="default"
                  loading={refresh.isPending}
                  onClick={() => refresh.mutate()}
                >
                  {t("settings.mapping_card.refresh_now")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}
