// @TODO Refactor in shared location for use with other @atproto packages

function isStringSlashString(value: string): value is `${string}/${string}` {
  const slashIndex = value.indexOf('/')

  if (slashIndex === -1) return false // Missing slash
  if (slashIndex === 0) return false // No leading part before the slash
  if (slashIndex === value.length - 1) return false // No trailing part after the slash
  if (value.includes('/', slashIndex + 1)) return false // More than one slash
  if (value.includes(' ')) return false // Spaces are not allowed

  return true
}

export type Mime = `${string}/${string}`

export function isMime(value: string): value is Mime {
  return isStringSlashString(value) && !value.includes('*')
}

export type Accept = '*/*' | `${string}/*` | Mime

export function isAccept(value: unknown): value is Accept {
  if (typeof value !== 'string') return false
  if (value === '*/*') return true // Fast path for the most common case
  if (!isStringSlashString(value)) return false
  return !value.includes('*') || value.endsWith('/*')
}

/**
 * @note "unsafe" in that it does not check if either {@link accept} or
 * {@link mime} are actually valid values (and could, therefore, lead to false
 * positives if forged values are used).
 */
function matchesAcceptUnsafe(accept: Accept, mime: Mime): boolean {
  if (accept === '*/*') {
    return true
  }
  if (accept.endsWith('/*')) {
    return mime.startsWith(accept.slice(0, -1))
  }
  return accept === mime
}

export function matchesAccept(accept: Accept, mime: string): boolean {
  return isMime(mime) && matchesAcceptUnsafe(accept, mime)
}

/**
 * @note "unsafe" in that it does not check if either {@link accept} or
 * {@link mime} are actually valid values (and could, therefore, lead to false
 * positives if forged values are used).
 */
function matchesAnyAcceptUnsafe(
  acceptable: Iterable<Accept>,
  mime: Mime,
): boolean {
  for (const accept of acceptable) {
    if (matchesAcceptUnsafe(accept, mime)) {
      return true
    }
  }
  return false
}

export function matchesAnyAccept(
  acceptable: Iterable<Accept>,
  mime: string,
): boolean {
  return isMime(mime) && matchesAnyAcceptUnsafe(acceptable, mime)
}
