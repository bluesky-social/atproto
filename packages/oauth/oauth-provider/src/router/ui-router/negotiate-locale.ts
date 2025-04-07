export const AVAILABLE_LOCALES = [
  //
  'en',
  'en-GB',
  'fr',
] as const

export type AvailableLocale = (typeof AVAILABLE_LOCALES)[number]
export const isAvailableLocale = (v: unknown): v is AvailableLocale =>
  (AVAILABLE_LOCALES as readonly unknown[]).includes(v)

export function negotiateLocale(desiredLocales?: readonly string[]): string {
  if (desiredLocales) {
    for (const locale of desiredLocales) {
      if (locale === '*') break // use default
      if (isAvailableLocale(locale)) return locale
    }
  }
  return 'en'
}
