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
import type { BlockDecoder, BlockEncoder, ByteView } from 'multiformats/block'
import { CID, DAG_CBOR_MULTICODEC, Lex } from '@atproto/lex-data'

export { CID }
export type { ByteView, Lex }

// @NOTE This was inspired by @ipld/dag-cbor implementation, but adapted to
// match ATPROTO Data Model constraints. Floats, in particular, are not allowed.

// @NOTE "cborg" version 4 is required to support multi-decoding via the
// "decodeFirst" function. However, that version only exposes ES modules.
// Because this package is using "commonjs", "cborg" will be bundled instead of
// depending on it directly.

const CID_CBOR_TAG = 42

function cidEncoder(obj: object): Token[] | null {
  const cid = CID.asCID(obj)
  if (!cid) return null

  const bytes = new Uint8Array(cid.bytes.byteLength + 1)
  bytes.set(cid.bytes, 1) // prefix is 0x00, for historical reasons
  return [new Token(Type.tag, CID_CBOR_TAG), new Token(Type.bytes, bytes)]
}

function undefinedEncoder(): null {
  throw new Error('`undefined` is not allowed by the ATPROTO Data Model')
}

function numberEncoder(num: number): null {
  if (Number.isInteger(num)) return null

  throw new Error('Non-integer numbers are not allowed by ATPROTO Data Model')
}

function mapEncoder(map: Map<unknown, unknown>): null {
  for (const key of map.keys()) {
    if (typeof key !== 'string') {
      throw new Error(
        'Only string keys are allowed in CBOR "map" by ATPROTO Data Model',
      )
    }
  }
  // @NOTE Map will be encoded as CBOR "map", which will be decoded as object.
  return null
}

const encodeOptions: EncodeOptions = {
  typeEncoders: {
    Map: mapEncoder,
    Object: cidEncoder,
    undefined: undefinedEncoder,
    number: numberEncoder,
  },
}

function cidDecoder(bytes: Uint8Array): CID {
  if (bytes[0] !== 0) {
    throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
  }
  return CID.decode(bytes.subarray(1)) // ignore leading 0x00
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

export function cborEncode<T extends Lex>(data: T): ByteView<T> {
  return cborgEncode(data, encodeOptions)
}

export function cborDecode<T extends Lex>(bytes: ByteView<T>): T {
  return cborgDecode(bytes, decodeOptions)
}

// @NOTE ATP uses the "dag-cbor" code (0x71) for block encoding/decoding but
// does not actually support the full "dag-cbor" specification. Instead, it uses
// a restricted subset defined in the atproto.com "Data Model".
export const atpCodec: BlockEncoder<0x71, Lex> & BlockDecoder<0x71, Lex> = {
  name: 'atp-cbor',
  code: DAG_CBOR_MULTICODEC,
  encode: cborEncode,
  decode: cborDecode,
}

export function* cborDecodeAll<T>(
  data: ByteView<T>,
): Generator<T, void, unknown> {
  do {
    const [result, remainingBytes] = cborgDecodeFirst(data, decodeOptions)
    yield result
    data = remainingBytes
  } while (data.byteLength > 0)
}
