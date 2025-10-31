import { useLingui } from '@lingui/react/macro'
import { ReactNode } from '@tanstack/react-router'
import { useMemo } from 'react'
import { LocaleSelector } from '#/components/LocaleSelector'
import { useCustomizationData } from '#/data/useCustomizationData'
import { useLocale } from '#/locales'
import { Locale, locales } from '#/locales/locales'
import { getLangString } from '#/util/lang'
import { useLangString } from '#/util/lang-string'
import type { LinkDefinition } from '@atproto/oauth-provider-api'

export function Footer() {
  const { locale, setLocale } = useLocale()
  const { links } = useCustomizationData()

  const translatedLinks = useMemo(() => {
    return links
      ?.map((link) =>
        typeof link.title === 'string'
          ? (link as typeof link & { title: string })
          : {
              ...link,
              title: getLangString(
                link.title,
                locale,
                link.title['en'] || Object.values(link.title).find(Boolean),
              ),
            },
      )
      .filter((link): link is typeof link & { title: string } => !!link.title)
  }, [links, locale])

  return (
    <footer className="h-15 bg-contrast-25 dark:bg-contrast-50 fixed inset-x-0 bottom-0 flex items-center justify-between px-4 md:px-6">
      <div className="flex flex-wrap">
        {translatedLinks?.map((link) => (
          <a
            href={link.href}
            className="text-text-light mr-4 text-sm hover:underline focus:underline focus:outline-none"
            key={link.href}
          >
            <LinkTitle link={link} />
          </a>
        ))}
      </div>

      <LocaleSelector
        items={Object.entries(locales).map(([code, l]) => ({
          label: l.flag + ' ' + l.name,
          value: code,
        }))}
        value={locale}
        onSelect={(value) => setLocale(value as Locale)}
      />
    </footer>
  )
}

export type LinkNameProps = {
  link: LinkDefinition
}

export function LinkTitle({ link }: LinkNameProps): ReactNode {
  const { t } = useLingui()

  const title = useLangString(link.title)
  if (title) return title

  // Fallback
  if (link.rel === 'canonical') return t`Home`
  if (link.rel === 'privacy-policy') return t`Privacy Policy`
  if (link.rel === 'terms-of-service') return t`Terms of Service`
  if (link.rel === 'help') return t`Support`

  // English version
  return typeof link.title === 'object'
    ? link.title['en'] || Object.values(link.title).find(Boolean)
    : link.title
}
