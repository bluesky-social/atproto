import { createContext, useContext } from 'react'
// @NOTE run "pnpm run po:compile" to compile the messages from the PO files
import { KnownLocale } from './locales.ts'

export type LocaleContextValue = {
  locale: string
  locales: Partial<Record<KnownLocale, { name: string; flag?: string }>>
  setLocale: (locale: KnownLocale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider')
  }
  return context
}
