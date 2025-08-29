/**
 * Only returns a string if it matches the desired locale.
 */
export function findMatchingString(
  value: string | Record<string, string | undefined>,
  locale: string,
  fallback?: string,
): string | undefined {
  switch (typeof value) {
    case 'string':
      // By convention, string values are in english
      if (locale === 'en' || locale.startsWith('en-')) return value
      break

    case 'object': {
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
          const fallbackMatch = value[k]
          if (typeof fallbackMatch === 'string') return fallbackMatch
        }
      }
    }
  }

  return fallback
}
