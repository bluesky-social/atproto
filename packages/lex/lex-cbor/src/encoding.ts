import {
  DecodeOptions,
  EncodeOptions,
  TagDecoder,
  Token,
  Type,
  decode as cborgDecode,
  decodeFirst as cborgDecodeFirst,
  encode as cborgEncode,
} from 'cborg'
import { OptionalTypeEncoder } from 'cborg/lib/encode'
import { Cid, LexValue, decodeCid, ifCid } from '@atproto/lex-data'

// @NOTE "cborg" version 4 is required to support multi-decoding via the
// "decodeFirst" function. However, that version only exposes ES modules.
// Because this package is using "commonjs", "cborg" will be bundled instead of
// depending on it directly.

const CID_CBOR_TAG = 42

/**
 * Configuration options for CBOR encoding that enforces AT Protocol data model
 * constraints.
 *
 * This configuration ensures:
 * - CIDs are encoded using CBOR tag 42 with a leading 0x00 byte prefix
 * - Map keys must be strings (no numeric or other key types allowed)
 * - `undefined` values are not permitted (undefined object properties will be stripped)
 * - Only safe integer numbers are allowed (no floats or non-integer values)
 */
export const encodeOptions = Object.freeze<EncodeOptions>({
  float64: true,
  ignoreUndefinedProperties: true,
  typeEncoders: Object.freeze<{ [typeName: string]: OptionalTypeEncoder }>({
    Map: (map: Map<unknown, unknown>): null => {
      for (const key of map.keys()) {
        if (typeof key !== 'string') {
          throw new Error(
            'Only string keys are allowed in CBOR "map" by the AT Data Model',
          )
        }
      }

      // @NOTE Maps will be encoded as CBOR "map", which will be decoded as object.
      return null
    },
    Object: (obj: object): Token[] | null => {
      const cid = ifCid(obj)
      if (cid) {
        const bytes = new Uint8Array(cid.bytes.byteLength + 1)
        bytes.set(cid.bytes, 1) // prefix is 0x00, for historical reasons
        return [new Token(Type.tag, CID_CBOR_TAG), new Token(Type.bytes, bytes)]
      }

      // Fallback to default object encoder
      return null
    },
    undefined: (): null => {
      throw new Error('`undefined` is not supported by the AT Data Model')
    },
    number: (num: number): null => {
      if (Number.isSafeInteger(num)) return null

      throw new Error(
        `Non-integer numbers (${num}) are not supported by the AT Data Model`,
      )
    },
  }),
})

/**
 * Configuration options for CBOR decoding that enforces AT Protocol data model
 * constraints.
 */
export const decodeOptions = /*#__PURE__*/ Object.freeze<DecodeOptions>({
  allowIndefinite: false,
  coerceUndefinedToNull: true,
  allowNaN: false,
  allowInfinity: false,
  allowBigInt: true,
  strict: true,
  useMaps: false,
  rejectDuplicateMapKeys: true,
  tags: /*#__PURE__*/ Object.freeze<TagDecoder[]>(
    /*#__PURE__*/ Object.assign([], {
      [CID_CBOR_TAG]: (bytes: Uint8Array): Cid => {
        if (bytes[0] !== 0) {
          throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
        }
        const cibBytes = bytes.subarray(1) // ignore leading 0x00
        return decodeCid(cibBytes)
      },
    }),
  ) as TagDecoder[],
})

/**
 * Encodes a LexValue to CBOR bytes using the AT Protocol data model (DRISL format).
 *
 * @param data - The LexValue to encode
 * @returns The CBOR-encoded bytes
 * @throws {Error} If the data contains non-string map keys, undefined values, or non-integer numbers
 *
 * @example
 * ```typescript
 * import { encode } from '@atproto/lex-cbor'
 *
 * // Encode a simple object
 * const bytes = encode({ text: 'Hello', count: 42 })
 *
 * // Encode an AT Protocol record
 * const recordBytes = encode({
 *   $type: 'app.bsky.feed.post',
 *   text: 'Hello from AT Protocol!',
 *   createdAt: new Date().toISOString(),
 * })
 * ```
 */
export function encode<T extends LexValue = LexValue>(data: T): Uint8Array {
  return cborgEncode(data, encodeOptions)
}

/**
 * Decodes CBOR bytes to a LexValue using the AT Protocol data model (DRISL format).
 *
 * @typeParam T - Allows casting the decoded values to a specific LexValue subtype
 * @param bytes - The CBOR bytes to decode
 * @returns The decoded LexValue
 * @throws {Error} If the bytes are not valid CBOR or violate AT Protocol constraints
 *
 * @example
 * ```typescript
 * import { encode, decode } from '@atproto/lex-cbor'
 * import type { LexValue } from '@atproto/lex'
 *
 * // Round-trip encoding and decoding
 * const original = { text: 'Hello', count: 42 }
 * const bytes = encode(original)
 * const decoded: LexValue = decode(bytes)
 *
 * // Decode with a specific type
 * interface Post {
 *   $type: string
 *   text: string
 *   createdAt: string
 * }
 * const post = decode<Post>(recordBytes)
 * ```
 */
export function decode<T extends LexValue = LexValue>(bytes: Uint8Array): T {
  return cborgDecode(bytes, decodeOptions)
}

/**
 * Generator that yields multiple decoded LexValues from a buffer containing
 * concatenated CBOR-encoded values.
 *
 * This is useful for processing streams or files containing multiple
 * CBOR-encoded records back-to-back (e.g., CAR file blocks or event streams).
 *
 * @typeParam T - Allows casting the decoded values to a specific LexValue subtype
 * @param data - The buffer containing one or more CBOR-encoded values
 * @yields Decoded LexValues one at a time
 * @throws {Error} If any value in the buffer is not valid CBOR or violates AT Protocol constraints
 *
 * @example
 * ```typescript
 * import { encode, decodeAll } from '@atproto/lex-cbor'
 *
 * // Concatenate multiple encoded values
 * const bytes1 = encode({ id: 1, text: 'First' })
 * const bytes2 = encode({ id: 2, text: 'Second' })
 * const combined = new Uint8Array([...bytes1, ...bytes2])
 *
 * // Decode all values from the combined buffer
 * for (const value of decodeAll(combined)) {
 *   console.log(value)
 * }
 * // Output:
 * // { id: 1, text: 'First' }
 * // { id: 2, text: 'Second' }
 * ```
 */
export function* decodeAll<T extends LexValue = LexValue>(
  data: Uint8Array,
): Generator<T, void, unknown> {
  do {
    const [result, remainingBytes] = cborgDecodeFirst(data, decodeOptions)
    yield result
    data = remainingBytes
  } while (data.byteLength > 0)
}
