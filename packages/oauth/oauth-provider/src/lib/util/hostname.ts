import { parse, ParsedDomain } from 'psl'

export function isInternetHost(host: string): boolean {
  return parseDomain(host) !== null
}

export function parseUrlDomain(input: string | URL): ParsedDomain | null {
  const url = new URL(input)
  return parseDomain(url.hostname)
}

export function parseDomain(domain: string) {
  const parsed = parse(domain)
  if ('listed' in parsed && parsed.listed && parsed.domain) {
    return parsed
  } else {
    return null
  }
}
