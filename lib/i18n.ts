// Localization strings loaded from JSON lang files

import en from "@/lang/en.json"
import he from "@/lang/he.json"

export type Locale = "he" | "en"

export const defaultLocale: Locale = "he"

export const locales: Locale[] = ["he", "en"]

export type Strings = typeof en

export const translations: Record<Locale, Strings> = {
  he: he as Strings,
  en: en as Strings,
}

// Direction and Intl locale tag per language
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
}

export const localeTag: Record<Locale, string> = {
  he: "he-IL",
  en: "en-US",
}

export function isLocale(value: unknown): value is Locale {
  return value === "he" || value === "en"
}

export function getStrings(locale: Locale): Strings {
  return translations[locale] ?? he
}

// Backwards-compatible default export of Hebrew strings
export const t = he

export type FrequencyKey = "none" | "sometimes" | "half" | "most" | "all" | "not_applicable"

const severityLabels: Record<Locale, Record<string, string>> = {
  he: {
    Normal: "תקין",
    Mild: "קל",
    Moderate: "בינוני",
    Severe: "חמור",
  },
  en: {
    Normal: "Normal",
    Mild: "Mild",
    Moderate: "Moderate",
    Severe: "Severe",
  },
}

export function getSeverityLabel(severity: string, locale: Locale = "he"): string {
  return severityLabels[locale]?.[severity] || severity
}
