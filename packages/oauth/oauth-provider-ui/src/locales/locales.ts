// @TODO Add more locales as they become available. Keep this in sync with
// .linguirc and the actual locale files in this directory.
export const locales = {
  en: {
    name: 'English',
    flag: '🇺🇸',
  },
  es: {
    name: 'Español',
    flag: '🇪🇸',
  },
  fr: {
    name: 'Français',
    flag: '🇫🇷',
  },
  ja: {
    name: '日本語',
    flag: '🇯🇵',
  },
  ko: {
    name: '한국어',
    flag: '🇰🇷',
  },
  sv: {
    name: 'svenska',
    flag: '🇸🇪',
  },
} as const satisfies Record<string, { name: string; flag?: string }>

export type Locale = keyof typeof locales

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && Object.hasOwn(locales, v)
}

export function asLocale(locale?: string): Locale | undefined {
  if (!locale) {
    return undefined
  }

  if (isLocale(locale)) {
    return locale
  }

  // Resolve similar locales (e.g. "fr-BE" -> "fr")
  const lang = locale.split('-')[0]
  if (isLocale(lang)) {
    return lang
  }

  // Resolve similar locales (e.g. "pt-PT" -> "pt-BR")
  for (const locale in locales) {
    if (locale.startsWith(`${lang}-`)) {
      return locale as keyof typeof locales
    }
  }

  return undefined
}

export function detectLocale(userLocales: readonly string[] = []): Locale {
  for (const locale of userLocales) {
    const resolved = asLocale(locale)
    if (resolved) return resolved
  }

  for (const locale of navigator.languages) {
    const resolved = asLocale(locale)
    if (resolved) return resolved
  }

  return 'en'
}
