import {
  Cid,
  CidCheckOptions,
  InferCheckedCid,
  parseCid,
} from '@atproto/lex-data'
import { JsonValue } from './json.js'

export function parseLexLink<TOptions extends CidCheckOptions>(
  input: undefined | Record<string, unknown>,
  options: TOptions,
): InferCheckedCid<TOptions> | undefined
export function parseLexLink(
  input?: Record<string, unknown>,
  options?: CidCheckOptions,
): Cid | undefined
export function parseLexLink(
  input?: Record<string, unknown>,
  options?: CidCheckOptions,
): Cid | undefined {
  if (!input || !('$link' in input)) {
    return undefined
  }

  for (const key in input) {
    if (key !== '$link') {
      return undefined
    }
  }

  const { $link } = input

  if (typeof $link !== 'string') {
    throw new TypeError('$link must be a base32-encoded CID string')
  }

  if ($link.length === 0) {
    throw new TypeError('CID string in $link cannot be empty')
  }

  // Arbitrary limit to prevent DoS via extremely long CIDs
  if ($link.length > 2048) {
    throw new TypeError('CID string in $link is too long')
  }

  try {
    return parseCid($link, options)
  } catch (cause) {
    throw new TypeError('Invalid CID string in $link', { cause })
  }
}

export function encodeLexLink(cid: Cid): JsonValue {
  return { $link: cid.toString() }
}
