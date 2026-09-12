import { utf8Len } from '@atproto/lex-data'

export function validateMaxUtf8Length(str: string, maxBytes?: number): boolean {
  if (maxBytes === undefined) return true
  if (maxBytes === Infinity) return true
  if (maxBytes === 0) return str.length === 0

  // Optimization: avoid computing UTF-8 length when string is definitely
  // smaller or larger than maxBytes
  if (str.length * 3 <= maxBytes) return true
  if (str.length > maxBytes * 3) return false

  return utf8Len(str) <= maxBytes
}
