import { Cid, parseCid } from '@atproto/lex-data'
import { JsonValue } from './json.js'

export function parseLexLink(input?: { $link?: unknown }): Cid | undefined {
  if (!input || !('$link' in input)) {
    return undefined
  }

  for (const key in input) {
    if (key !== '$link') {
      return undefined
    }
  }

  if (typeof input.$link !== 'string') {
    throw new TypeError('$link must be a base32-encoded CID string')
  }

  if (input.$link.length === 0) {
    throw new TypeError('CID string in $link cannot be empty')
  }

  // Arbitrary limit to prevent DoS via extremely long CIDs
  if (input.$link.length > 2048) {
    throw new TypeError('CID string in $link is too long')
  }

  try {
    return parseCid(input.$link)
  } catch (cause) {
    throw new TypeError('Invalid CID string in $link', { cause })
  }
}

export function encodeLexLink(cid: Cid): JsonValue {
  return { $link: cid.toString() }
}
