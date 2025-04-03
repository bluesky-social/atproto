import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import * as cborCodec from '@ipld/dag-cbor'
import * as mf from 'multiformats'
import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { check, schema } from '@atproto/common-web'

export const cborEncode = cborCodec.encode
export const cborDecode = cborCodec.decode

export const dataToCborBlock = async (data: unknown) => {
  return Block.encode({
    value: data,
    codec: cborCodec,
    hasher: sha256,
  })
}

export const cidForCbor = async (data: unknown): Promise<CID> => {
  const block = await dataToCborBlock(data)
  return block.cid
}

export const isValidCid = async (cidStr: string): Promise<boolean> => {
  try {
    const parsed = CID.parse(cidStr)
    return parsed.toString() === cidStr
  } catch (err) {
    return false
  }
}

export const cborBytesToRecord = (
  bytes: Uint8Array,
): Record<string, unknown> => {
  const val = cborDecode(bytes)
  if (!check.is(val, schema.map)) {
    throw new Error(`Expected object, got: ${val}`)
  }
  return val
}

export const verifyCidForBytes = async (cid: CID, bytes: Uint8Array) => {
  const digest = await sha256.digest(bytes)
  const expected = CID.createV1(cid.code, digest)
  if (!cid.equals(expected)) {
    throw new Error(
      `Not a valid CID for bytes. Expected: ${expected.toString()} Got: ${cid.toString()}`,
    )
  }
}

export const sha256ToCid = (hash: Uint8Array, codec: number): CID => {
  const digest = mf.digest.create(sha256.code, hash)
  return CID.createV1(codec, digest)
}

export const sha256RawToCid = (hash: Uint8Array): CID => {
  return sha256ToCid(hash, rawCodec.code)
}

// @NOTE: Only supports DASL CIDs
// https://dasl.ing/cid.html
export const parseCidFromBytes = (cidBytes: Uint8Array): CID => {
  const version = cidBytes[0]
  if (version !== 0x01) {
    throw new Error(`Unsupported CID version: ${version}`)
  }
  const codec = cidBytes[1]
  if (codec !== 0x55 && codec !== 0x71) {
    throw new Error(`Unsupported CID codec: ${codec}`)
  }
  const hashType = cidBytes[2]
  if (hashType !== 0x12) {
    throw new Error(`Unsupported CID hash function: ${hashType}`)
  }
  const hashLength = cidBytes[3]
  if (hashLength !== 32) {
    throw new Error(`Unexpected CID hash length: ${hashLength}`)
  }
  const rest = cidBytes.slice(4)
  return sha256ToCid(rest, codec)
}

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
