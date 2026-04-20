import { BlobRef, Cid, LexMap, LexValue, isCid } from '@atproto/lex-data'
import { parseTypedBlobRef } from './blob.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { JsonValue } from './json.js'
import { encodeLexLink, parseLexLink } from './link.js'

export type SpecialJsonObjectOptions = {
  /**
   * When true, objects that contain a `$link`, `$bytes`, or `$type` property
   * but do not conform to the expected structure of those special objects will
   * be rejected with a `TypeError`. When false (default), such objects will be
   * treated as plain JSON objects without special parsing.
   *
   * @default false
   */
  strict?: boolean
}

/**
 * @internal
 */
export function encodeSpecialJsonObject(input: LexValue): JsonValue | void {
  if (isCid(input)) {
    return encodeLexLink(input)
  } else if (ArrayBuffer.isView(input)) {
    return encodeLexBytes(input)
  }
}

/**
 * @internal
 */
export function parseSpecialJsonObject(
  input: LexMap,
  options?: SpecialJsonObjectOptions,
): Cid | Uint8Array | BlobRef | void {
  // Hot path: use hints to avoid parsing when possible

  if (input.$link !== undefined) {
    const cid = parseLexLink(input)
    if (cid) return cid
    if (options?.strict) throw new TypeError(`Invalid $link object`)
  } else if (input.$bytes !== undefined) {
    const bytes = parseLexBytes(input)
    if (bytes) return bytes
    if (options?.strict) throw new TypeError(`Invalid $bytes object`)
  } else if (input.$type !== undefined) {
    // @NOTE Since blobs are "just" regular lex objects with a special shape,
    // and because an object that does not conform to the blob shape would still
    // result in undefined being returned, we only attempt to parse blobs when
    // the strict option is enabled.
    if (options?.strict) {
      if (input.$type === 'blob') {
        const blob = parseTypedBlobRef(input, options)
        if (blob) return blob
        throw new TypeError(`Invalid blob object`)
      } else if (typeof input.$type !== 'string') {
        throw new TypeError(`Invalid $type property (${typeof input.$type})`)
      } else if (input.$type.length === 0) {
        throw new TypeError(`Empty $type property`)
      }
    }
  }

  // @NOTE We ignore legacy blob representation here. They can be handled at the
  // application level if needed.

  return undefined
}
