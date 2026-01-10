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
import { Cid, LexValue, decodeCid, ifCid } from '@atproto/lex-data'

// @NOTE This was inspired by @ipld/dag-cbor implementation, but adapted to
// match the AT Data Model constraints. Floats, in particular, are not allowed.

// @NOTE "cborg" version 4 is required to support multi-decoding via the
// "decodeFirst" function. However, that version only exposes ES modules.
// Because this package is using "commonjs", "cborg" will be bundled instead of
// depending on it directly.

const CID_CBOR_TAG = 42

function cidEncoder(cid: Cid): Token[] {
  const bytes = new Uint8Array(cid.bytes.byteLength + 1)
  bytes.set(cid.bytes, 1) // prefix is 0x00, for historical reasons
  return [new Token(Type.tag, CID_CBOR_TAG), new Token(Type.bytes, bytes)]
}

function objectEncoder(
  obj: object,
  _typ: string,
  _options: EncodeOptions,
): Token[] | null {
  const cid = ifCid(obj)
  if (cid) return cidEncoder(cid)

  // @TODO strip undefined values somehow
  // https://github.com/rvagg/cborg/issues/154

  // Fallback to default object encoder
  return null
}

function undefinedEncoder(): null {
  throw new Error('`undefined` is not allowed by the AT Data Model')
}

function numberEncoder(num: number): null {
  if (Number.isInteger(num) && Number.isSafeInteger(num)) return null

  throw new Error('Non-integer numbers are not allowed by the AT Data Model')
}

function mapEncoder(map: Map<unknown, unknown>): null {
  for (const key of map.keys()) {
    if (typeof key !== 'string') {
      throw new Error(
        'Only string keys are allowed in CBOR "map" by the AT Data Model',
      )
    }
  }
  // @NOTE Map will be encoded as CBOR "map", which will be decoded as object.
  return null
}

const encodeOptions: EncodeOptions = {
  float64: true,
  typeEncoders: {
    Map: mapEncoder,
    Object: objectEncoder,
    undefined: undefinedEncoder,
    number: numberEncoder,
  },
}

function cidDecoder(bytes: Uint8Array): Cid {
  if (bytes[0] !== 0) {
    throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
  }
  return decodeCid(bytes.subarray(1)) // ignore leading 0x00
}

const tagDecoders: TagDecoder[] = []
tagDecoders[CID_CBOR_TAG] = cidDecoder
const decodeOptions: DecodeOptions = {
  allowIndefinite: false,
  coerceUndefinedToNull: true,
  allowNaN: false,
  allowInfinity: false,
  allowBigInt: true,
  strict: true,
  useMaps: false,
  rejectDuplicateMapKeys: true,
  tags: tagDecoders,
}

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
