export const LOCALES = ["en", "fr", "ar"] as const;
export type SupportedLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const RTL_LOCALES: SupportedLocale[] = ["ar"];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  fr: "Francais",
  ar: "Arabic",
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: SupportedLocale) {
  return RTL_LOCALES.includes(locale);
}

