import { I18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
// @NOTE run "pnpm run po:compile" to compile the messages from the PO files
import { messages as en } from './en/messages.ts'
import { loadMessages } from './load.ts'
import { Locale, detectLocale, isLocale, locales } from './locales.ts'

export type LocaleContextValue = {
  locale: string
  locales: Partial<Record<Locale, { name: string; flag?: string }>>
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider')
  }
  return context
}

export function useCurrentLocale(): string {
  return useLocaleContext().locale
}

export function LocaleProvider({
  userLocales = [],
  children,
}: {
  userLocales?: readonly string[]
  children?: ReactNode
}) {
  // Bundle "en" messages with the app
  const i18n = useMemo(() => new I18n({ locale: 'en', messages: { en } }), [])

  const [currentLocale, setCurrentLocale] = useState<string>(() => i18n.locale)
  const [desiredLocale, setDesiredLocale] = useState<Locale>(() => {
    return detectLocale(userLocales)
  })

  // A boolean that is used to avoid flickering of "en" content during initial
  // load.
  const [initialized, setInitialized] = useState(
    desiredLocale === currentLocale,
  )

  // Protect against illegal change of the locale directly through the i18n object
  useEffect(() => {
    if (!isLocale(currentLocale)) {
      setDesiredLocale('en')
    }
  }, [locales, currentLocale])

  // Keep currentLocale in sync with i18n's locale prop
  useEffect(() => {
    const onChange = () => setCurrentLocale(i18n.locale)
    i18n.on('change', onChange)
    return () => i18n.removeListener('change', onChange)
  }, [i18n])

  // Trigger loading of `desiredLocale`
  useEffect(() => {
    if (currentLocale === desiredLocale) {
      setInitialized(true)
      return
    }

    let canceled = false
    loadMessages(desiredLocale)
      .then((messages) => {
        i18n.load(desiredLocale, messages)
        if (!canceled) i18n.activate(desiredLocale)
      })
      .catch((err) => {
        console.error(`Failed to load locale "${desiredLocale}":`, err)
      })
      .finally(() => {
        if (!canceled) setInitialized(true)
      })
    return () => {
      canceled = true
    }
  }, [currentLocale, desiredLocale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: currentLocale,
      locales,
      setLocale: (locale) => {
        if (isLocale(locale)) setDesiredLocale(locale)
        else throw new TypeError(`"${locale}" is not an available locale`)
      },
    }),
    [locales, currentLocale],
  )

  return (
    <LocaleContext value={value}>
      <I18nProvider i18n={i18n}>{initialized && children}</I18nProvider>
    </LocaleContext>
  )
}
