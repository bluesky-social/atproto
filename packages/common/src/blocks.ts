import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as mf from 'multiformats'
import * as blockCodec from '@ipld/dag-cbor'

export const valueToIpldBlock = async (data: unknown) => {
  return Block.encode({
    value: data,
    codec: blockCodec,
    hasher: blockHasher,
  })
}

export const sha256RawToCid = (hash: Uint8Array): CID => {
  const digest = mf.digest.create(blockHasher.code, hash)
  return CID.createV1(rawCodec.code, digest)
}

export const cidForData = async (data: unknown): Promise<CID> => {
  const block = await valueToIpldBlock(data)
  return block.cid
}

export const valueToIpldBytes = (value: unknown): Uint8Array => {
  return blockCodec.encode(value)
}

export const ipldBytesToValue = (bytes: Uint8Array) => {
  return blockCodec.decode(bytes)
}

export const ipldBytesToRecord = (bytes: Uint8Array): object => {
  const val = ipldBytesToValue(bytes)
  if (typeof val !== 'object' || val === null) {
    throw new Error(`Expected object, got: ${val}`)
  }
  return val
}
