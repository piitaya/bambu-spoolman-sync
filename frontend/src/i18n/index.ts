import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fr from "./fr.json";

export const LANGUAGES = {
  en: { label: "English" },
  fr: { label: "Français" }
} as const;

export type Language = keyof typeof LANGUAGES;

const DEFAULT_LANGUAGE: Language = "en";
const STORAGE_KEY = "language";

function detectInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
  if (stored && stored in LANGUAGES) return stored;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  return nav && nav in LANGUAGES ? (nav as Language) : DEFAULT_LANGUAGE;
}

export function persistLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore quota / private mode
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr }
  },
  lng: detectInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false // React already escapes
  },
  returnNull: false
});

export default i18n;
