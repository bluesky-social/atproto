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
import { Locale, detectLocale, locales } from './locales'

const Context = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  localizeString: (value: LocalizedString) => string
}>({
  locale: 'en',
  setLocale: () => {},
  localizeString: () => '',
})

export function Provider({ children }: { children: ReactNode }) {
  const prevLocale = useRef<Locale>('en')
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
      if (locale in locales) {
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
      return value[locale] || value['en']
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
