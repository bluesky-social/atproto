export function isIP(hostname: string) {
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
