import {
  CheckCidOptions,
  Cid,
  InferCheckedCid,
  parseCid,
} from '@atproto/lex-data'
import { JsonValue } from './json.js'

/**
 * Parses a `{$link: string}` JSON object into a {@link Cid} instance.
 *
 * In the ATProto data model, CID references are represented in JSON as an
 * object with a single `$link` property containing a base32-encoded CID string,
 * prefixed with "b". This function decodes that representation into a `Cid`
 * object.
 *
 * @param input - An object potentially containing a `{$link: string}` property
 * @param options - Optional CID validation options
 * @returns The parsed {@link Cid} if the input is a valid `$link` object,
 *          or `undefined` if the input is not a valid `$link` representation
 * @throws {TypeError} If `$link` is present but is not a valid CID string
 *
 * @example
 * ```typescript
 * // Parse a $link object to Cid
 * const cid = parseLexLink({ $link: 'bafyreib2rxk3rybloqtqwbo' })
 * // cid is a Cid instance
 *
 * // Returns undefined for non-$link objects
 * const result = parseLexLink({ foo: 'bar' })
 * // result is undefined
 *
 * // Returns undefined for objects with extra properties
 * const invalid = parseLexLink({ $link: 'bafyrei...', extra: true })
 * // invalid is undefined
 * ```
 */
export function parseLexLink<TOptions extends CheckCidOptions>(
  input: undefined | Record<string, unknown>,
  options: TOptions,
): InferCheckedCid<TOptions> | undefined
export function parseLexLink(
  input?: Record<string, unknown>,
  options?: CheckCidOptions,
): Cid | undefined
export function parseLexLink(
  input?: Record<string, unknown>,
  options?: CheckCidOptions,
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

/**
 * Encodes a {@link Cid} instance into a `{$link: string}` JSON representation.
 *
 * In the ATProto data model, CID references are represented in JSON as an
 * object with a single `$link` property containing a base32-encoded CID string,
 * prefixed with "b". This function performs that encoding.
 *
 * @param cid - The CID to encode
 * @returns An object with a `$link` property containing the string representation of the CID
 *
 * @example
 * ```typescript
 * const cid = CID.parse('bafyreib2rxk3rybloqtqwbo')
 * const encoded = encodeLexLink(cid)
 * // encoded is { $link: 'bafyreib2rxk3rybloqtqwbo' }
 * ```
 */
export function encodeLexLink(cid: Cid): JsonValue {
  return { $link: cid.toString() }
}
