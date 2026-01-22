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

export function encode<T extends LexValue = LexValue>(data: T): Uint8Array {
  return cborgEncode(data, encodeOptions)
}

export function decode<T extends LexValue = LexValue>(bytes: Uint8Array): T {
  return cborgDecode(bytes, decodeOptions)
}

export function* decodeAll<T extends LexValue = LexValue>(
  data: Uint8Array,
): Generator<T, void, unknown> {
  do {
    const [result, remainingBytes] = cborgDecodeFirst(data, decodeOptions)
    yield result
    data = remainingBytes
  } while (data.byteLength > 0)
}
