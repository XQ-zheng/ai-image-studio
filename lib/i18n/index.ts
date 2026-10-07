import { locales, type Locale } from "./dictionary";

export * from "./dictionary";

export function resolveLocale(value: string | undefined): Locale {
  if (value && (locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return "zh";
}