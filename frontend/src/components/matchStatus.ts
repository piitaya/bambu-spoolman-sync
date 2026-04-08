import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MatchType } from "../api";

export interface MatchStatusInfo {
  label: string;
  color: string;
  description: string;
}

const MATCH_COLORS: Record<MatchType, string> = {
  matched: "teal",
  known_unmapped: "yellow",
  unknown_variant: "orange",
  third_party: "gray",
  unknown_spool: "gray",
  empty: "gray"
};

/** Canonical display order for the legend. */
export const MATCH_STATUS_ORDER: MatchType[] = [
  "matched",
  "known_unmapped",
  "unknown_variant",
  "third_party",
  "unknown_spool",
  "empty"
];

/**
 * Build the localized match-status table from the active language.
 * Memoized so referential identity is stable across renders that
 * don't change the language.
 */
export function useMatchStatus(): Record<MatchType, MatchStatusInfo> {
  const { t, i18n } = useTranslation();
  return useMemo(
    () => ({
      matched: {
        label: t("status.mapped.label"),
        color: MATCH_COLORS.matched,
        description: t("status.mapped.description")
      },
      known_unmapped: {
        label: t("status.unmapped.label"),
        color: MATCH_COLORS.known_unmapped,
        description: t("status.unmapped.description")
      },
      unknown_variant: {
        label: t("status.unknown.label"),
        color: MATCH_COLORS.unknown_variant,
        description: t("status.unknown.description")
      },
      third_party: {
        label: t("status.third_party.label"),
        color: MATCH_COLORS.third_party,
        description: t("status.third_party.description")
      },
      unknown_spool: {
        label: t("status.unknown_spool.label"),
        color: MATCH_COLORS.unknown_spool,
        description: t("status.unknown_spool.description")
      },
      empty: {
        label: t("status.empty.label"),
        color: MATCH_COLORS.empty,
        description: t("status.empty.description")
      }
    }),
    // i18n.language ensures the memo recomputes on language switch
    // even though the t function reference is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
}
