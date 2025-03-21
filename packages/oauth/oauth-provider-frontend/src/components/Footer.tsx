import React from 'react'

import { Dropdown } from '#/components/Dropdown'
import { localesDisplay } from '#/locales/localesDisplay'
import { useLocale, Locale } from '#/locales'
import { useCustomizationData } from '#/data/useCustomizationData'
import { InlineLink } from '#/components/Link'

export function Footer() {
  const { locale, setLocale, localizeString } = useLocale()
  const { links } = useCustomizationData()

  return (
    <footer className="fixed inset-x-0 bottom-0 px-4 md:px-6 h-15 bg-contrast-25 dark:bg-contrast-50 flex items-center justify-between">
      <div className="flex flex-wrap">
        {links?.map((link) => (
          <InlineLink
            href={link.href}
            className="text-sm text-text-light mr-4"
            key={link.href}
          >
            {localizeString(link.title)}
          </InlineLink>
        ))}
      </div>

      <Dropdown
        items={Object.entries(localesDisplay).map(([code, l]) => ({
          label: l.flag + ' ' + l.name,
          value: code,
        }))}
        value={locale}
        onSelect={(value) => setLocale(value as Locale)}
      />
    </footer>
  )
}
