import { create as createDigest } from 'multiformats/hashes/digest'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import {
  CID,
  DAG_CBOR_MULTICODEC,
  LexValue,
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
} from '@atproto/lex-data'
import { encode } from './encoding.js'

export { CID, hasher }
export { decode, decodeAll, encode } from './encoding.js'
export type { LexValue }

export async function cidForLex(value: LexValue): Promise<CID> {
  return cidForCbor(encode(value))
}

export async function cidForCbor(bytes: Uint8Array): Promise<CID> {
  const digest = await hasher.digest(bytes)
  return CID.createV1(DAG_CBOR_MULTICODEC, digest)
}

export async function verifyCidForBytes(cid: CID, bytes: Uint8Array) {
  const digest = await hasher.digest(bytes)
  const expected = CID.createV1(cid.code, digest)
  if (!cid.equals(expected)) {
    throw new Error(
      `Not a valid CID for bytes. Expected: ${expected.toString()} Got: ${cid.toString()}`,
    )
  }
}

export async function cidForRawBytes(bytes: Uint8Array): Promise<CID> {
  const digest = await hasher.digest(bytes)
  return CID.createV1(RAW_BIN_MULTICODEC, digest)
}

export function cidForRawHash(hash: Uint8Array): CID {
  const digest = createDigest(hasher.code, hash)
  return CID.createV1(RAW_BIN_MULTICODEC, digest)
}

/**
 * @note Only supports DASL CIDs
 * @see {@link https://dasl.ing/cid.html}
 * @throws if the input do not represent a valid DASL {@link CID}
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
  if (hashType !== SHA2_256_MULTIHASH_CODE) {
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
