import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

export const valueToIpldBlock = async (
  data: unknown,
): Promise<Block.Block<unknown>> => {
  return Block.encode({
    value: data,
    codec: blockCodec,
    hasher: blockHasher,
  })
}

export const cidForData = async (data: unknown): Promise<CID> => {
  const block = await valueToIpldBlock(data)
  return block.cid
}

export const valueToIpldBytes = async (value: unknown): Promise<Uint8Array> => {
  const block = await valueToIpldBlock(value)
  return block.bytes
}

export const ipldBytesToValue = async (
  cid: CID,
  bytes: Uint8Array,
): Promise<unknown> => {
  const block = await Block.create({
    bytes,
    cid,
    codec: blockCodec,
    hasher: blockHasher,
  })
  return block.value
}
