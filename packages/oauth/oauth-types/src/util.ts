export const canParseUrl =
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  URL.canParse?.bind(URL) ??
  // URL.canParse is not available in Node.js < 18.7.0
  ((urlStr: string): boolean => {
    try {
      new URL(urlStr)
      return true
    } catch {
      return false
    }
  })

export function isHostnameIP(hostname: string) {
  // IPv4
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return true

  // IPv6
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true

  return false
}

export type LoopbackHost = 'localhost' | '127.0.0.1' | '[::1]'

export function isLoopbackHost(host: unknown): host is LoopbackHost {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function isLocalHostname(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length < 2) return true

  const tld = parts.at(-1)!.toLowerCase()
  return (
    tld === 'test' ||
    tld === 'local' ||
    tld === 'localhost' ||
    tld === 'invalid' ||
    tld === 'example'
  )
}

export function safeUrl(input: URL | string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

export function extractUrlPath(url) {
  // Extracts the path from a URL, without relying on the URL constructor
  // (because it normalizes the URL)
  const endOfProtocol = url.startsWith('https://')
    ? 8
    : url.startsWith('http://')
      ? 7
      : -1
  if (endOfProtocol === -1) {
    throw new TypeError('URL must use the "https:" or "http:" protocol')
  }

  const hashIdx = url.indexOf('#', endOfProtocol)
  const questionIdx = url.indexOf('?', endOfProtocol)

  const queryStrIdx =
    questionIdx !== -1 && (hashIdx === -1 || questionIdx < hashIdx)
      ? questionIdx
      : -1

  const pathEnd =
    hashIdx === -1
      ? queryStrIdx === -1
        ? url.length
        : queryStrIdx
      : queryStrIdx === -1
        ? hashIdx
        : Math.min(hashIdx, queryStrIdx)

  const slashIdx = url.indexOf('/', endOfProtocol)

  const pathStart = slashIdx === -1 || slashIdx > pathEnd ? pathEnd : slashIdx

  if (endOfProtocol === pathStart) {
    throw new TypeError('URL must contain a host')
  }

  return url.substring(pathStart, pathEnd)
}

export const jsonObjectPreprocess = (val: unknown) => {
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }

  return val
}

export const numberPreprocess = (val: unknown): unknown => {
  if (typeof val === 'string') {
    const number = Number(val)
    if (!Number.isNaN(number)) return number
  }
  return val
}

/**
 * Returns true if the two arrays contain the same elements, regardless of order
 * or duplicates.
 */
export function arrayEquivalent<T>(a: readonly T[], b: readonly T[]) {
  if (a === b) return true
  return a.every(includedIn, b) && b.every(includedIn, a)
}

export function includedIn<T>(this: readonly T[], item: T) {
  return this.includes(item)
}

export function asArray<T>(
  value: Iterable<T> | undefined,
): undefined | readonly T[] {
  if (value == null) return undefined
  if (Array.isArray(value)) return value // already a (possibly readonly) array
  return Array.from(value)
}

export type SpaceSeparatedValue<Value extends string> =
  `${'' | `${string} `}${Value}${'' | ` ${string}`}`

export const isSpaceSeparatedValue = <Value extends string>(
  value: Value,
  input: string,
): input is SpaceSeparatedValue<Value> => {
  if (value.length === 0) throw new TypeError('Value cannot be empty')
  if (value.includes(' ')) throw new TypeError('Value cannot contain spaces')

  // Optimized version of:
  // return input.split(' ').includes(value)

  const inputLength = input.length
  const valueLength = value.length

  if (inputLength < valueLength) return false

  let idx = input.indexOf(value)
  let idxEnd: number

  while (idx !== -1) {
    idxEnd = idx + valueLength

    if (
      // at beginning or preceded by space
      (idx === 0 || input.charCodeAt(idx - 1) === 32) &&
      // at end or followed by space
      (idxEnd === inputLength || input.charCodeAt(idxEnd) === 32)
    ) {
      return true
    }

    idx = input.indexOf(value, idxEnd + 1)
  }

  return false
}
