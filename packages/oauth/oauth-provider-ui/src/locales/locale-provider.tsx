import { I18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { ReactNode, useEffect, useMemo, useState } from 'react'
// @NOTE run "pnpm run po:compile" to compile the messages from the PO files
import { messages as en } from './en/messages.ts'
import { loadMessages } from './load.ts'
import { LocaleContext, LocaleContextValue } from './locale-context.ts'
import { KnownLocale, knownLocales, locales, resolveLocale } from './locales.ts'

export type LocaleProviderProps = {
  availableLocales?: readonly string[]
  children?: ReactNode
}

export function LocaleProvider({
  availableLocales,
  children,
}: LocaleProviderProps) {
  // Bundle "en" messages with the app
  const [i18n] = useState(() => new I18n({ locale: 'en', messages: { en } }))

  const [desiredLocale, setDesiredLocale] = useState<KnownLocale>(() =>
    detectLocale(
      knownLocales.filter(
        (l) => !availableLocales || availableLocales.includes(l),
      ),
    ),
  )
  const [currentLocale, setCurrentLocale] = useState<string>(() => i18n.locale)

  const [loaded, setLoaded] = useState(desiredLocale === currentLocale)

  // Keep currentLocale in sync with i18n
  useEffect(() => {
    const onChange = () => {
      setCurrentLocale(i18n.locale)
      document.documentElement.setAttribute('lang', i18n.locale)
    }
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
      locales: Object.fromEntries(
        knownLocales
          .filter((l) => !availableLocales || availableLocales.includes(l))
          .map((l) => [l, locales[l]]),
      ),
      setLocale: setDesiredLocale,
    }),
    [currentLocale, availableLocales, locales, setDesiredLocale],
  )

  return (
    <LocaleContext value={value}>
      <I18nProvider i18n={i18n}>{loaded && children}</I18nProvider>
    </LocaleContext>
  )
}

function detectLocale<L extends string>(
  availableLocales: readonly L[],
  fallbackLocale: L | 'en' = 'en',
): L {
  // Use, in priority, the locale that was set by the backend
  if (typeof document === 'object') {
    const htmlLang = document.documentElement.getAttribute('lang')
    const resolved = htmlLang && resolveLocale(htmlLang, availableLocales)
    if (resolved) return resolved
  }

  // Should that fail (though it should probably never), negotiate with the browser
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
