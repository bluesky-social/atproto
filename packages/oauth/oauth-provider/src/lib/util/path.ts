export function isSubUrl(reference: URL, url: URL): boolean {
  if (url.origin !== reference.origin) return false
  if (url.username !== reference.username) return false
  if (url.password !== reference.password) return false

  return isSubPath(reference.pathname, url.pathname)
}

function isSubPath(reference: string, path: string): boolean {
  if (reference === path) return true
  if (!path.startsWith(reference)) return false
  if (!reference.endsWith('/') && path[reference.length] !== '/') return false

  return true
}
