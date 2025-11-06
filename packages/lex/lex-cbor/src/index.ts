import { Block, encode as encodeBlock } from 'multiformats/block'
import { code as rawCodecCode } from 'multiformats/codecs/raw'
import { create as createDigest } from 'multiformats/hashes/digest'
import { sha256 } from 'multiformats/hashes/sha2'
import { CID, Lex, LexObject } from '@atproto/lex-data'
import { Code, codec } from './codec.js'

export * from './codec.js'

export async function dataToCborBlock<T extends Lex>(
  value: T,
): Promise<Block<T>> {
  return encodeBlock<T, Code, 18>({ value, codec, hasher: sha256 })
}

export async function cidForCbor(value: Lex): Promise<CID> {
  return cidForBytes(codec.encode(value))
}

export async function cidForBytes(bytes: Uint8Array): Promise<CID> {
  const hash = await sha256.digest(bytes)
  return CID.createV1(codec.code, hash)
}

export async function verifyCidForBytes(cid: CID, bytes: Uint8Array) {
  const expected = await cidForBytes(bytes)
  if (!cid.equals(expected)) {
    throw new Error(
      `Not a valid CID for bytes. Expected: ${expected.toString()} Got: ${cid.toString()}`,
    )
  }
}

export type LexRecord = LexObject & { $type: string }
export function cborToLexRecord(bytes: Uint8Array): LexRecord {
  const data = codec.decode(bytes)
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
  return data as LexObject & { $type: string }
}

export function sha256ToCid(hash: Uint8Array, code: number): CID {
  const digest = createDigest(sha256.code, hash)
  return CID.createV1(code, digest)
}

export function sha256RawToCid(hash: Uint8Array): CID {
  return sha256ToCid(hash, rawCodecCode)
}

// @NOTE: Only supports DASL CIDs
// https://dasl.ing/cid.html
export function parseCidFromBytes(cidBytes: Uint8Array): CID {
  const version = cidBytes[0]
  if (version !== 0x01) {
    throw new Error(`Unsupported CID version: ${version}`)
  }
  const code = cidBytes[1]
  if (code !== 0x55 && code !== 0x71) {
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
  const hash = cidBytes.slice(4)
  return sha256ToCid(hash, code)
}
