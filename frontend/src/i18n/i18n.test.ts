import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

// Every user-facing string must exist in BOTH locales. This test makes
// a missing translation a test failure instead of a silent fallback.
describe("i18n locale files", () => {
  it("en.json and fr.json declare exactly the same keys", () => {
    const enKeys = collectKeys(en).sort();
    const frKeys = collectKeys(fr).sort();
    const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
    const missingInEn = frKeys.filter((k) => !enKeys.includes(k));
    expect(missingInFr, "keys missing in fr.json").toEqual([]);
    expect(missingInEn, "keys missing in en.json").toEqual([]);
  });
});
