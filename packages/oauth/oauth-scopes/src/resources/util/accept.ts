// @TODO Refactor in shared location for use with other @atproto packages

export type Accept = '*/*' | `${string}/*` | `${string}/${string}`

export function isAccept(value: string): value is Accept {
  if (value === '*/*') return true

  const slashIndex = value.indexOf('/')

  if (slashIndex === -1) return false
  if (slashIndex === 0 || slashIndex === value.length - 1) return false

  if (value.includes('/', slashIndex + 1)) return false
  if (value.includes(' ')) return false

  // If there is a "*", it has to be right after the slash and at the end
  // (ensuring there is only one)
  const starIndex = value.indexOf('*')
  if (
    starIndex !== -1 &&
    (starIndex !== slashIndex + 1 || starIndex !== value.length - 1)
  ) {
    return false
  }

  return true
}

export function matchesAccept(accept: Accept, mime: string): boolean {
  if (accept === '*/*') {
    return true
  }
  if (accept.endsWith('/*')) {
    return mime.startsWith(accept.slice(0, -1))
  }
  return accept === mime
}

export function matchesAnyAccept(
  acceptable: Iterable<Accept>,
  mime: string,
): boolean {
  for (const accept of acceptable) {
    if (matchesAccept(accept, mime)) {
      return true
    }
  }
  return false
}
