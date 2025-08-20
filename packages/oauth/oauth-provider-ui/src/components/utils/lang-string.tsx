import { ReactNode, useMemo } from 'react'
import { getLangString } from '#/lib/lang'
import { useCurrentLocale } from '#/locales/locale-provider'
import type { MultiLangString } from '@atproto/oauth-provider-api'

export type LangStringProps = {
  value?: string | MultiLangString
  fallback?: ReactNode
}

export function LangString({ value, fallback }: LangStringProps): ReactNode {
  const matchingString = useLangString(value)
  return (
    matchingString ||
    fallback ||
    // If a fallback is not provided, return the english version, if it exists,
    // or any string otherwise
    (typeof value === 'object'
      ? value['en'] || Object.values(value).find(Boolean)
      : value)
  )
}

export function useLangString(
  value?: string | MultiLangString,
  fallback?: string,
) {
  const locale = useCurrentLocale()
  return useMemo(() => {
    return getLangString(value, locale, fallback)
  }, [value, locale, fallback])
}
