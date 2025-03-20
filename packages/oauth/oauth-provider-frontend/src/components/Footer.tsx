import React from 'react'

import { Dropdown } from '#/components/Dropdown'
import { localesDisplay } from '#/locales/localesDisplay'
import { useLocale } from '#/locales'
import { useCustomizationData } from '#/data/useCustomizationData'

export function Footer() {
  const { locale, setLocale } = useLocale()
  const { links } = useCustomizationData()

  return (
    <footer className="fixed inset-x-0 bottom-0 px-4 md:px-6 h-15 bg-contrast-50 flex items-center justify-between">
      <div className="p-4 bg-contrast-50 rounded-lg" style={{ width: 120 }} />
      <Dropdown
        items={Object.entries(localesDisplay).map(([code, l]) => ({
          label: l.flag + ' ' + l.name,
          value: code,
        }))}
        value={locale}
        onSelect={setLocale}
      />
    </footer>
  )
}
