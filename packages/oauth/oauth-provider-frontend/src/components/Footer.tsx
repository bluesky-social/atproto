import { InlineLink } from '#/components/Link'
import { LocaleSelector } from '#/components/LocaleSelector'
import { useCustomizationData } from '#/data/useCustomizationData'
import { useLocale } from '#/locales'
import { Locale, locales } from '#/locales/locales'

export function Footer() {
  const { locale, setLocale, localizeString } = useLocale()
  const { links } = useCustomizationData()

  return (
    <footer className="h-15 bg-contrast-25 dark:bg-contrast-50 fixed inset-x-0 bottom-0 flex items-center justify-between px-4 md:px-6">
      <div className="flex flex-wrap">
        {links?.map((link) => (
          <InlineLink
            href={link.href}
            className="text-text-light mr-4 text-sm"
            key={link.href}
          >
            {localizeString(link.title)}
          </InlineLink>
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
