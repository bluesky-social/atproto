type LangStringValue =
  | undefined
  | null
  | string
  | Record<string, string | undefined>

/**
 * Only returns a string if it matches the desired {@link locale}, or return the
 * provided {@link fallback}.
 */
export function getLangString(
  value: LangStringValue,
  locale: string,
  fallback: string,
): string
export function getLangString(
  value: LangStringValue,
  locale: string,
  fallback?: string,
): string | undefined
export function getLangString(
  value: LangStringValue,
  locale: string,
  fallback?: string,
): string | undefined {
  switch (typeof value) {
    case 'string':
      // By convention, string values are in english
      if (locale === 'en' || locale.startsWith('en-')) return value
      break

    case 'object': {
      // Fool-proof
      if (value === null) break

      // Exact match
      const localeMatch = value[locale]
      if (typeof localeMatch === 'string') return localeMatch

      // Fallback to language match  (e.g. "fr-BE" -> "fr")
      const lang = locale.split('-')[0]
      const langMatch = value[lang]
      if (typeof langMatch === 'string') return langMatch

      // Fallback to any locale from same language (e.g. "pt-PT" -> "pt-BR")
      for (const k in value) {
        if (k.startsWith(`${lang}-`)) {
          const countryMatch = value[k]
          if (typeof countryMatch === 'string') return countryMatch
        }
      }
    }
  }

  return fallback
}
