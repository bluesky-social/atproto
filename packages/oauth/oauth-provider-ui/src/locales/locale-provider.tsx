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
import { KnownLocale, knownLocales, locales } from './locales.ts'

export type LocaleContextValue = {
  locale: string
  locales: Partial<Record<KnownLocale, { name: string; flag?: string }>>
  setLocale: (locale: KnownLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider')
  }
  return context
}

export function LocaleProvider({
  allowedLocales,
  userLocales = [],
  children,
}: {
  allowedLocales?: readonly KnownLocale[]
  userLocales?: readonly string[]
  children?: ReactNode
}) {
  // Bundle "en" messages with the app
  const i18n = useMemo(() => new I18n({ locale: 'en', messages: { en } }), [])

  // `availableLocales` is the list of known locales that are available to the user
  const availableLocales = useMemo((): readonly KnownLocale[] => {
    if (!allowedLocales) return knownLocales

    const filtered = knownLocales.filter((l) => allowedLocales.includes(l))
    if (filtered.length) return filtered

    return ['en']
  }, allowedLocales ?? [])

  const [currentLocale, setCurrentLocale] = useState<string>(() => i18n.locale)
  const [desiredLocale, setDesiredLocale] = useState<KnownLocale>(() => {
    return detectLocale(userLocales, availableLocales)
  })

  // A boolean that is used to avoid flickering of "en" content during initial
  // load.
  const [initialized, setInitialized] = useState(
    desiredLocale === currentLocale,
  )

  // Protect against illegal change of the locale directly through the i18n object
  useEffect(() => {
    if (!(availableLocales as readonly string[]).includes(currentLocale)) {
      setDesiredLocale(availableLocales[0]!)
    }
  }, [currentLocale, availableLocales])

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
      locales: Object.fromEntries(availableLocales.map((l) => [l, locales[l]])),
      setLocale: (locale) => {
        if (availableLocales.includes(locale)) setDesiredLocale(locale)
        else throw new TypeError(`"${locale}" is not an available locale`)
      },
    }),
    [currentLocale, availableLocales],
  )

  return (
    <LocaleContext value={value}>
      <I18nProvider i18n={i18n}>{initialized && children}</I18nProvider>
    </LocaleContext>
  )
}

function detectLocale<L extends string>(
  userLocales: readonly string[],
  availableLocales: readonly L[],
  fallbackLocale: L | 'en' = 'en',
): L {
  for (const locale of userLocales) {
    const resolved = resolveLocale(locale, availableLocales)
    if (resolved) return resolved
  }

  if (typeof navigator === 'object' && navigator.languages) {
    for (const locale of navigator.languages) {
      const resolved = resolveLocale(locale, availableLocales)
      if (resolved) return resolved
    }
  }

  const fallback = resolveLocale(fallbackLocale, availableLocales)
  if (fallback) return fallback

  // Type-safety
  throw new TypeError(
    `Available locales should always contain "${fallbackLocale}"`,
  )
}

export function resolveLocale<L extends string>(
  locale: string,
  availableLocales: readonly L[],
): L | undefined {
  if ((availableLocales as readonly string[]).includes(locale)) {
    return locale as L
  }

  const lang = locale.split('-')[0]
  if ((availableLocales as readonly string[]).includes(lang)) {
    return lang as L
  }

  const similar = availableLocales.find((l) => l.startsWith(`${lang}-`))
  if (similar) {
    return similar as L
  }

  return undefined
}
