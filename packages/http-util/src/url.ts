export type UrlReference = {
  origin?: string
  pathname?: string
  searchParams?: Iterable<readonly [string, string]> // compatible with URLSearchParams
}

export function urlMatch(url: URL, reference: UrlReference) {
  if (reference.origin !== undefined) {
    if (url.origin !== reference.origin) return false
  }

  if (reference.pathname !== undefined) {
    if (url.pathname !== reference.pathname) return false
  }

  if (reference.searchParams !== undefined) {
    for (const [key, value] of reference.searchParams) {
      if (url.searchParams.get(key) !== value) return false
    }
  }

  return true
}
