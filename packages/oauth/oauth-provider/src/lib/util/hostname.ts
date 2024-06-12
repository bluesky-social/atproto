import { parse as pslParse } from 'psl'

export function isInternetHost(host: string): boolean {
  const parsed = pslParse(host)
  return 'listed' in parsed && parsed.listed === true
}
