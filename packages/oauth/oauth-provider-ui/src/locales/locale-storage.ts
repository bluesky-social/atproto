import { type Locale, isLocale } from './locales.ts'

// @NOTE Storage is scoped to the origin, so the choice made on the
// authorization page also applies to the account page (and survives a reload of
// either). The origin is shared with whatever else the PDS serves, hence the
// `@@<package>(<key>)` namespacing used by `@atproto/oauth-client-browser`.
const STORAGE_KEY = `@@atproto/oauth-provider-ui(locale)`

/**
 * Reading `localStorage` throws (rather than returning `null`) when the browser
 * is configured to block storage access, so every access here is guarded.
 */
export function readStoredLocale(): Locale | undefined {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLocale(value)) return value
  } catch {
    // Ignore
  }
  return undefined
}

export function writeStoredLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Persisting the preference is best effort; the locale still applies to the
    // current page.
  }
}
