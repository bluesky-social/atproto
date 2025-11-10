import { Block, encode as encodeBlock } from 'multiformats/block'
import { code as rawCodecCode } from 'multiformats/codecs/raw'
import { create as createDigest } from 'multiformats/hashes/digest'
import { sha256 } from 'multiformats/hashes/sha2'
import {
  CID,
  DAG_CBOR_MULTICODEC,
  Lex,
  LexMap,
  RAW_BIN_MULTICODEC,
} from '@atproto/lex-data'
import { atpCodec } from './codec.js'

export * from './codec.js'

export type { Block }
export async function lexToCborBlock<T extends Lex>(
  value: T,
): Promise<Block<T>> {
  return encodeBlock<T, 0x71, 0x12>({ value, codec: atpCodec, hasher: sha256 })
}

export async function cidForLex(value: Lex): Promise<CID> {
  const { cid } = await lexToCborBlock(value)
  return cid
}

export async function verifyCidForCbor(cid: CID, bytes: Uint8Array) {
  const hash = await sha256.digest(bytes)
  const expected = CID.createV1(atpCodec.code, hash)
  if (!cid.equals(expected)) {
    throw new Error(
      `Not a valid CID for bytes. Expected: ${expected.toString()} Got: ${cid.toString()}`,
    )
  }
}

export type TypedLexMap = LexMap & { $type: string }
export function cborToTypedLexMap(bytes: Uint8Array): TypedLexMap {
  const data = atpCodec.decode(bytes)
  if (
    data == null ||
    typeof data !== 'object' ||
    // @NOTE Array, Uint8Array and CID don't have a "$type" property
    !('$type' in data) ||
    !data.$type ||
    typeof data.$type !== 'string'
  ) {
    throw new Error(`Expected record with $type property`)
  }
  return data as TypedLexMap
}

export function cidForRawHash(hash: Uint8Array): CID {
  const digest = createDigest(sha256.code, hash)
  return CID.createV1(rawCodecCode, digest)
}

/**
 * @note Only supports DASL CIDs
 * @see {@link https://dasl.ing/cid.html}
 * @returns `undefined` if the input do not represent a valid DASL {@link CID}
 */
export function parseCidFromBytes(cidBytes: Uint8Array): CID {
  const version = cidBytes[0]
  if (version !== 0x01) {
    throw new Error(`Unsupported CID version: ${version}`)
  }
  const code = cidBytes[1]
  if (code !== RAW_BIN_MULTICODEC && code !== DAG_CBOR_MULTICODEC) {
    throw new Error(`Unsupported CID codec: ${code}`)
  }
  const hashType = cidBytes[2]
  if (hashType !== 0x12) {
    throw new Error(`Unsupported CID hash function: ${hashType}`)
  }
  const hashLength = cidBytes[3]
  if (hashLength !== 32) {
    throw new Error(`Unexpected CID hash length: ${hashLength}`)
  }
  if (hashLength !== cidBytes.length - 4) {
    throw new Error(`Unexpected CID bytes length: ${hashLength}`)
  }
  const hashBytes = cidBytes.slice(4)
  const digest = createDigest(hashType, hashBytes)
  return CID.create(version, code, digest)
}
