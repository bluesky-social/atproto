import { parse, ParsedDomain } from 'psl'

export function isInternetUrl(url: URL): boolean {
  return parseUrlPublicSuffix(url) !== null
}

export function isInternetHost(host: string): boolean {
  return parseDomainPublicSuffix(host) !== null
}

export function parseUrlPublicSuffix(input: string | URL): ParsedDomain | null {
  const { hostname } = new URL(input)
  return parseDomainPublicSuffix(hostname)
}

export function parseDomainPublicSuffix(domain: string): ParsedDomain | null {
  const parsed = parse(domain)
  if ('listed' in parsed && parsed.listed && parsed.domain) {
    return parsed
  } else {
    return null
  }
}
