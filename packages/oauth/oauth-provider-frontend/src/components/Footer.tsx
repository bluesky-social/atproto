import { useMemo } from 'react'
import { LocaleSelector } from '#/components/LocaleSelector'
import { useCustomizationData } from '#/data/useCustomizationData'
import { useLocale } from '#/locales'
import { Locale, locales } from '#/locales/locales'
import { findMatchingString } from '#/util/lang'

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
              title: findMatchingString(
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
            {link.title}
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
