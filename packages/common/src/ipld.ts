import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import * as mf from 'multiformats'
import * as ui8 from 'uint8arrays'
import * as cborCodec from '@ipld/dag-cbor'
import { check, schema } from '.'
import { z } from 'zod'

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

export const cborBytesToRecord = (
  bytes: Uint8Array,
): Record<string, unknown> => {
  const val = cborDecode(bytes)
  if (!check.is(val, schema.record)) {
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

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | unknown
  | Array<JsonValue>
  | { [key: string]: JsonValue }

export type IpldValue =
  | JsonValue
  | CID
  | Uint8Array
  | Array<IpldValue>
  | { [key: string]: IpldValue }

const dagJsonCid = z
  .object({
    $link: z.string(),
  })
  .strict()

const dagJsonBytes = z
  .object({
    $bytes: z.string(),
  })
  .strict()

const dagJsonVal = z.union([dagJsonCid, dagJsonBytes])

export const jsonToIpld = (val: JsonValue): IpldValue => {
  // check for dag json values
  if (check.is(val, dagJsonVal)) {
    if (check.is(val, dagJsonCid)) {
      return CID.parse(val.$link)
    }
    return ui8.fromString(val.$bytes, 'base64')
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => jsonToIpld(item))
  }
  if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = jsonToIpld(val[key])
    }
    return toReturn
  }
  return val
}

export const ipldToJson = (val: IpldValue): JsonValue => {
  // convert bytes
  if (check.is(val, schema.bytes)) {
    return {
      $bytes: ui8.toString(val, 'base64'),
    }
  }
  // convert cids
  if (check.is(val, schema.cid)) {
    return {
      $link: val.toString(),
    }
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => ipldToJson(item))
  }
  if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldToJson(val[key])
    }
    return toReturn
  }
  return val as JsonValue
}
