import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import { Block, ByteView, encode as encodeBlock } from 'multiformats/block'
import {
  // eslint-disable-next-line
  cidForCbor,
  cidForLex,
  cidForRawHash,
  decode,
  encode,
  hasher,
  parseCidFromBytes,
  verifyCidForBytes,
} from '@atproto/lex-cbor'
import {
  CID,
  DAG_CBOR_MULTICODEC,
  LexValue,
  isTypedLexMap,
  validateCidString,
} from '@atproto/lex-data'

/**
 * @deprecated Use {@link encode} from `@atproto/lex-cbor` instead.
 */
const cborEncodeLegacy = encode as <T = unknown>(data: T) => ByteView<T>
export { cborEncodeLegacy as cborEncode }

/**
 * @deprecated Use {@link decode} from `@atproto/lex-cbor` instead.
 */
const cborDecodeLegacy = decode as <T = unknown>(bytes: ByteView<T>) => T
export { cborDecodeLegacy as cborDecode }

/**
 * @deprecated Use {@link encode} and {@link cidForCbor} from `@atproto/lex-cbor` instead.
 */
export async function dataToCborBlock<T>(value: T): Promise<Block<T>> {
  return encodeBlock<T, 0x71, 0x12>({
    value,
    codec: {
      name: 'at-cbor', // Not actually used
      code: DAG_CBOR_MULTICODEC,
      encode: encode as (data: T) => ByteView<T>,
    },
    hasher,
  })
}

/**
 * @deprecated Use {@link cidForLex} from `@atproto/lex-cbor` instead.
 */
export const cidForCborLegacy = cidForLex as (data: unknown) => Promise<CID>
export { cidForCborLegacy as cidForCbor }

/**
 * @deprecated Use {@link validateCidString} from '@atproto/lex-data' instead.
 */
export async function isValidCid(cidStr: string): Promise<boolean> {
  // @NOTE we keep the wrapper function to return a Promise (for backward
  // compatibility).
  return validateCidString(cidStr)
}

/**
 * @deprecated Use {@link decode} from `@atproto/lex-cbor`, and {@link isTypedLexMap} from `@atproto/lex-data` instead.
 */
export function cborBytesToRecord(bytes: Uint8Array): Record<string, unknown> {
  const data = decode(bytes) as LexValue
  if (isTypedLexMap(data)) return data

  throw new Error(`Expected record with $type property`)
}

/**
 * @deprecated Use {@link verifyCidForBytes} from `@atproto/lex-cbor` instead.
 */
const verifyCidForBytesLegacy = verifyCidForBytes
export { verifyCidForBytesLegacy as verifyCidForBytes }

/**
 * @deprecated Use {@link cidForRawHash} from `@atproto/lex-cbor` instead.
 */
export const sha256RawToCid = cidForRawHash as (hash: Uint8Array) => CID

/**
 * @deprecated Use {@link parseCidFromBytes} from `@atproto/lex-cbor` instead.
 */
const parseCidFromBytesLegacy = parseCidFromBytes as (bytes: Uint8Array) => CID
export { parseCidFromBytesLegacy as parseCidFromBytes }

export class VerifyCidTransform extends Transform {
  constructor(public cid: CID) {
    const hasher = createHash('sha256')
    super({
      transform(chunk, encoding, callback) {
        hasher.update(chunk)
        callback(null, chunk)
      },
      flush(callback) {
        try {
          const actual = sha256RawToCid(hasher.digest())
          if (actual.equals(cid)) {
            return callback()
          } else {
            return callback(new VerifyCidError(cid, actual))
          }
        } catch (err) {
          return callback(asError(err))
        }
      },
    })
  }
}

const asError = (err: unknown): Error =>
  err instanceof Error ? err : new Error('Unexpected error', { cause: err })

export class VerifyCidError extends Error {
  constructor(
    public expected: CID,
    public actual: CID,
  ) {
    super('Bad cid check')
  }
}
