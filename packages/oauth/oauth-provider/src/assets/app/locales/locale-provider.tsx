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
import { Locale, locales, resolveLocale } from './locales.ts'

export type LocaleContextValue = {
  locale: string
  locales: Record<Locale, { name: string; flag?: string }>
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

export type LocaleProviderProps = {
  children?: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  // Bundle "en" messages with the app
  const [i18n] = useState(() => new I18n({ locale: 'en', messages: { en } }))

  const [desiredLocale, setDesiredLocale] = useState(detectLocale)
  const [currentLocale, setCurrentLocale] = useState<string>(() => i18n.locale)

  const [loaded, setLoaded] = useState(desiredLocale === currentLocale)

  // Keep currentLocale in sync with i18n
  useEffect(() => {
    const onChange = () => setCurrentLocale(i18n.locale)
    i18n.on('change', onChange)
    return () => i18n.removeListener('change', onChange)
  }, [i18n])

  useEffect(() => {
    if (currentLocale === desiredLocale) {
      setLoaded(true)
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
        if (!canceled) setLoaded(true)
      })
    return () => {
      canceled = true
    }
  }, [currentLocale, desiredLocale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: currentLocale,
      locales,
      setLocale: setDesiredLocale,
    }),
    [currentLocale, locales, setDesiredLocale],
  )

  return (
    <LocaleContext value={value}>
      <I18nProvider i18n={i18n}>{loaded && children}</I18nProvider>
    </LocaleContext>
  )
}

function detectLocale(): Locale {
  if (typeof navigator === 'object' && navigator.languages) {
    for (const locale of navigator.languages) {
      const resolved = resolveLocale(locale)
      if (resolved) return resolved
    }
  }

  if (typeof document === 'object') {
    const htmlLang = document.documentElement.getAttribute('lang')
    const resolved = htmlLang && resolveLocale(htmlLang)
    if (resolved) return resolved
  }

  return 'en'
}
