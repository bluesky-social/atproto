import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import {
  Block,
  ByteView,
  LexValue,
  atpCodec,
  cborToTypedLexMap,
  cidForLex,
  cidForRawHash,
  lexToCborBlock,
  parseCidFromBytes,
  verifyCidForCbor,
} from '@atproto/lex-cbor'
import { CID, validateCidString } from '@atproto/lex-data'

/**
 * @deprecated Use {@link cborEncode} from `@atproto/lex-cbor` instead.
 */
export function cborEncode<T = unknown>(data: T): ByteView<T> {
  return atpCodec.encode(data as LexValue) as ByteView<T>
}

/**
 * @deprecated Use {@link cborDecode} from `@atproto/lex-cbor` instead.
 */
export function cborDecode<T = unknown>(bytes: ByteView<T>): T {
  return atpCodec.decode(bytes) as T
}

/**
 * @deprecated Use {@link lexToCborBlock} from `@atproto/lex-cbor` instead.
 */
export async function dataToCborBlock<T>(data: T): Promise<Block<T>> {
  return lexToCborBlock(data as LexValue) as Promise<Block<T>>
}

/**
 * @deprecated Use {@link cidForLex} from `@atproto/lex-cbor` instead.
 */
export async function cidForCbor(data: unknown): Promise<CID> {
  return cidForLex(data as LexValue)
}

/**
 * @deprecated Use {@link validateCidString} from '@atproto/lex-data' instead.
 */
export async function isValidCid(cidStr: string): Promise<boolean> {
  return validateCidString(cidStr)
}

/**
 * @deprecated Use {@link cborToTypedLexMap} from `@atproto/lex-cbor` instead.
 */
export function cborBytesToRecord(bytes: Uint8Array): Record<string, unknown> {
  return cborToTypedLexMap(bytes)
}

/**
 * @deprecated Use {@link verifyCidForCbor} from `@atproto/lex-cbor` instead.
 */
export async function verifyCidForBytes(cid: CID, bytes: Uint8Array) {
  return verifyCidForCbor(cid, bytes)
}

/**
 * @deprecated Use {@link cidForRawHash} from `@atproto/lex-cbor` instead.
 */
export function sha256RawToCid(hash: Uint8Array): CID {
  return cidForRawHash(hash)
}

export { parseCidFromBytes }

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
          const actual = cidForRawHash(hasher.digest())
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
