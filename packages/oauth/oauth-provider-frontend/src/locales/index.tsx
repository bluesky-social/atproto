import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { LocalizedString } from '#/api'
import { activateLocale } from '#/locales/activateLocale'
import { detectLocale } from '#/locales/detectLocale'
import { Locale } from '#/locales/types'

export * from '#/locales/types'

const Context = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  localizeString: (value: LocalizedString) => string
}>({
  locale: Locale.en,
  setLocale: () => {},
  localizeString: () => '',
})

export function Provider({ children }: { children: ReactNode }) {
  const prevLocale = useRef<Locale>(Locale.en)
  const [locale, setLocale] = useState<Locale>(detectLocale)

  useEffect(() => {
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

  const safeSetLocale = useCallback(
    (locale: Locale) => {
      if (locale in Locale) {
        setLocale(locale)
      } else {
        throw new Error(`Unsupported locale: ${locale}`)
      }
    },
    [setLocale],
  )

  const localizeString = useCallback(
    (value: LocalizedString) => {
      if (typeof value === 'string') return value
      return value[locale] || value[Locale.en]
    },
    [locale],
  )

  const ctx = useMemo(
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
  return useContext(Context)
}
