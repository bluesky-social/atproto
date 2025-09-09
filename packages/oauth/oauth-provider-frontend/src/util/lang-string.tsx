import { ReactNode, useMemo } from 'react'
import { useLocale } from '#/locales'
import type { MultiLangString } from '@atproto/oauth-provider-api'
import { getLangString } from './lang'

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
  const { locale } = useLocale()
  return useMemo(() => {
    return getLangString(value, locale, fallback)
  }, [value, locale, fallback])
}

export function LangProp<
  P extends string,
  O extends {
    [K in P]?: string
  } & {
    [K in P as `${K}:lang`]?: MultiLangString
  },
>({
  object,
  property,
  fallback,
}: {
  property: P
  object?: O
  fallback?: ReactNode
}): ReactNode {
  if (!object) return fallback
  return (
    <LangString
      value={object[`${property}:lang` as keyof O]}
      fallback={object[property] ?? fallback}
    />
  )
}
