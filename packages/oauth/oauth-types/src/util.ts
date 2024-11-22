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

export function isLoopbackUrl(input: URL | string): boolean {
  const url = typeof input === 'string' ? new URL(input) : input
  return isLoopbackHost(url.hostname)
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
