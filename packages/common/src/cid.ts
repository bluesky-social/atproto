import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

export const cidForData = async (data: unknown): Promise<CID> => {
  const block = await Block.encode({
    value: data,
    codec: blockCodec,
    hasher: blockHasher,
  })
  return block.cid
}
