import { useLingui } from '@lingui/react/macro'
import { ReactNode, useMemo } from 'react'
import type { LocalizedString } from '@atproto/oauth-provider-api'

export type MultiLangStringProps = {
  value: LocalizedString
  fallback?: ReactNode
}

export function MultiLangString({
  value,
  fallback,
}: MultiLangStringProps): ReactNode {
  const matchingString = useMatchingString(value)
  return (
    matchingString ?? fallback ?? (typeof value === 'string' ? value : value.en)
  )
}

function useMatchingString(value: LocalizedString) {
  const { i18n } = useLingui()
  return useMemo(
    () => findMatchingString(value, i18n.locale),
    [value, i18n.locale],
  )
}

/**
 * Only returns a string if it matches the desired locale.
 */
function findMatchingString(
  value: LocalizedString,
  locale: string,
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

  return undefined
}
