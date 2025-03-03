export function negotiateLocale(
  availableLocales: readonly string[],
): string | null {
  if (navigator.languages) {
    for (const lang of navigator.languages) {
      if (availableLocales.includes(lang)) return lang
      const cc = lang.split('-')[0]
      if (availableLocales.includes(cc)) return cc
    }
  }
  return null
}
