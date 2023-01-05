import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import * as mf from 'multiformats'
import * as cborCodec from '@ipld/dag-cbor'

export const valueToIpldBlock = async (data: unknown) => {
  return Block.encode({
    value: data,
    codec: cborCodec,
    hasher: sha256,
  })
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

export const sha256RawToCid = (hash: Uint8Array): CID => {
  const digest = mf.digest.create(sha256.code, hash)
  return CID.createV1(rawCodec.code, digest)
}

export const cidForData = async (data: unknown): Promise<CID> => {
  const block = await valueToIpldBlock(data)
  return block.cid
}

export const valueToIpldBytes = (value: unknown): Uint8Array => {
  return cborCodec.encode(value)
}

export const ipldBytesToValue = (bytes: Uint8Array) => {
  return cborCodec.decode(bytes)
}

export const ipldBytesToRecord = (bytes: Uint8Array): object => {
  const val = ipldBytesToValue(bytes)
  if (typeof val !== 'object' || val === null) {
    throw new Error(`Expected object, got: ${val}`)
  }
  return val
}
