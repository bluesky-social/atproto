import { isAbsolute, relative } from 'node:path'

export function isSubUrl(reference: URL, url: URL): boolean {
  if (url.origin !== reference.origin) return false
  if (url.username !== reference.username) return false
  if (url.password !== reference.password) return false

  return (
    reference.pathname === url.pathname ||
    isSubPath(reference.pathname, url.pathname)
  )
}

function isSubPath(reference: string, path: string): boolean {
  const rel = relative(reference, path)
  return !rel.startsWith('..') && !isAbsolute(rel)
}
