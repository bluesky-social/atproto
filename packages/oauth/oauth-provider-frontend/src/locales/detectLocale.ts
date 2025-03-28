import { Locale } from '#/locales/types'

export function detectLocale(): Locale {
  const lang = document.documentElement.getAttribute('lang')
  if (lang && lang in Locale) return lang as Locale

  for (const locale of navigator.languages) {
    if (locale in Locale) return locale as Locale
  }

  return Locale.en
}
