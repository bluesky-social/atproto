import {
  BlobRef,
  BlobRefCheckOptions,
  LexMap,
  isBlobRef,
} from '@atproto/lex-data'
import { parseLexLink } from './link.js'

/**
 * Parses a blob reference from a JSON object.
 *
 * In the AT Protocol, blobs are referenced using a specific object structure
 * with `$type: 'blob'`, a `ref` property containing a CID link, and metadata
 * like `mimeType` and `size`. This function validates and parses such objects
 * into `BlobRef` instances.
 *
 * The function handles both cases where the `ref` property is:
 * - A `{$link: string}` object (when parsing from JSON)
 * - Already a `Cid` instance (when the parent object has been partially converted)
 *
 * @param input - A Lex map potentially representing a blob reference
 * @param options - Optional blob reference validation options
 * @returns The parsed `BlobRef` if the input is a valid blob reference,
 *          or `undefined` if the input is not a valid blob representation
 *
 * @example
 * ```typescript
 * // Parse a blob reference from JSON
 * const blobRef = parseBlobRef({
 *   $type: 'blob',
 *   ref: { $link: 'bafyreib2rxk3rybloqtqwbo' },
 *   mimeType: 'image/png',
 *   size: 12345
 * })
 *
 * // blobRef.ref is a Cid instance
 *
 * // Returns undefined for non-blob objects
 * const result = parseBlobRef({ foo: 'bar' })
 * // result is undefined
 * ```
 */
export function parseBlobRef(
  input: LexMap,
  options?: BlobRefCheckOptions,
): BlobRef | undefined {
  if (input.$type !== 'blob') return undefined

  const ref = input?.ref
  if (!ref || typeof ref !== 'object') return undefined

  // @NOTE Because json to lex conversion can be performed both in a depth-first
  // manner (e.g. via lexParse) or in a breadth-first manner (e.g. via
  // jsonToLex), the `ref` property may either be a LexMap with a $link
  // property, or it may already be a CID instance.

  if ('$link' in ref) {
    const cid = parseLexLink(ref)
    if (!cid) return undefined

    const blob = { ...input, ref: cid }
    if (isBlobRef(blob, options)) return blob
  }

  if (isBlobRef(input)) {
    return input
  }

  return undefined
}
