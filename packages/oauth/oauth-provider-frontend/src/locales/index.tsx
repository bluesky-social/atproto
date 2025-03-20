import React from 'react'

import { Locale } from '#/locales/types'
import { detectLocale } from '#/locales/detectLocale'
import { activateLocale } from '#/locales/activateLocale'

const Context = React.createContext({
  locale: Locale.en,
  setLocale: (_locale: Locale) => {},
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

  const ctx = React.useMemo(
    () => ({
      locale,
      setLocale: safeSetLocale,
    }),
    [locale, safeSetLocale],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useLocale() {
  return React.useContext(Context)
}
