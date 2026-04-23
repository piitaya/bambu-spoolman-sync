import { useMediaQuery } from "@mantine/hooks";

export const MOBILE_QUERY = "(max-width: 48em)";

export function useIsMobile(): boolean {
  // getInitialValueInEffect: false runs matchMedia synchronously on first
  // render instead of deferring to useEffect. We need the correct value on
  // mount so things that depend on it (e.g. the active scroll container in
  // Spools) don't transiently pick the wrong branch.
  return (
    useMediaQuery(MOBILE_QUERY, false, { getInitialValueInEffect: false }) ??
    false
  );
}
