import React from 'react'

import { LocalizedString } from '#/api'
import { Locale } from '#/locales/types'
import { detectLocale } from '#/locales/detectLocale'
import { activateLocale } from '#/locales/activateLocale'

export * from '#/locales/types'

const Context = React.createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  localizeString: (value: LocalizedString) => string
}>({
  locale: Locale.en,
  setLocale: () => {},
  localizeString: () => '',
})

export function Provider({ children }: { children: React.ReactNode }) {
  const prevLocale = React.useRef<Locale>(Locale.en)
  const [locale, setLocale] = React.useState<Locale>(detectLocale)

  React.useEffect(() => {
    if (prevLocale.current !== locale) {
      activateLocale(locale)
        .then(() => {
          prevLocale.current = locale
        })
        .catch((e) => {
          console.error(e)
          setLocale(prevLocale.current)
        })
    }
  }, [locale, setLocale])

  const safeSetLocale = React.useCallback(
    (locale: Locale) => {
      if (locale in Locale) {
        setLocale(locale)
      } else {
        throw new Error(`Unsupported locale: ${locale}`)
      }
    },
    [setLocale],
  )

  const localizeString = React.useCallback(
    (value: LocalizedString) => {
      if (typeof value === 'string') return value
      return value[locale] || value[Locale.en]
    },
    [locale],
  )

  const ctx = React.useMemo(
    () => ({
      locale,
      setLocale: safeSetLocale,
      localizeString,
    }),
    [locale, safeSetLocale, localizeString],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useLocale() {
  return React.useContext(Context)
}
