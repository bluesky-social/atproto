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
import { activateLocale } from '#/locales/activateLocale'
import { Locale, detectLocale, locales } from './locales'

const Context = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
}>({
  locale: 'en',
  setLocale: () => {},
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

  const ctx = useMemo(
    () => ({
      locale,
      setLocale: safeSetLocale,
    }),
    [locale, safeSetLocale],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useLocale() {
  return useContext(Context)
}
