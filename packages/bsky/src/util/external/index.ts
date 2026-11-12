const HOST_LABEL = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/

const isHostname = (value: string): boolean =>
  value.split('.').every((label) => HOST_LABEL.test(label))

type DomainPattern = { host: string; wildcard: boolean }

const parseDomainPattern = (entry: string): DomainPattern | undefined => {
  const value = entry.trim().toLowerCase()
  const wildcard = value.startsWith('*.')
  const host = wildcard ? value.slice(2) : value
  return host && isHostname(host) ? { host, wildcard } : undefined
}

/**
 * Whether the original request `url` is on a configured safe domain. Plain
 * entries match that host exactly; `*.example.com` matches subdomains at any
 * depth but not `example.com` itself. Only credential-free `https:` URLs on
 * the default port qualify. Pure: no DNS, redirects, or record-declared URLs.
 */
export const isExternalRecordUrlSafe = (
  url: string,
  domains: readonly string[],
): boolean => {
  if (!domains.length) return false
  // `new URL` normalizes backslashes and strips control characters, so
  // reject them up front instead of matching a rewritten URL.
  // eslint-disable-next-line no-control-regex
  if (!/^https:\/\//i.test(url) || /[\\\u0000-\u0020\u007f]/.test(url)) {
    return false
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.port !== '') return false
  if (parsed.username || parsed.password) return false
  // The parser drops an empty userinfo (`https://@host`), so check the raw authority.
  if (/^https:\/\/[^/?#]*@/i.test(url)) return false

  const host = parsed.hostname.toLowerCase()
  if (!isHostname(host)) return false
  return domains.some((entry) => {
    const pattern = parseDomainPattern(entry)
    if (!pattern) return false
    return pattern.wildcard
      ? host.endsWith(`.${pattern.host}`)
      : host === pattern.host
  })
}
