import { Locale, isLocale } from './locales'

export function detectLocale(): Locale {
  const lang = document.documentElement.getAttribute('lang')
  if (isLocale(lang)) return lang as Locale

  for (const locale of navigator.languages) {
    if (isLocale(locale)) return locale as Locale
  }

  return 'en'
}
