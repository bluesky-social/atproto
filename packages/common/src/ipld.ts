import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import * as mf from 'multiformats'
import { base64 } from 'multiformats/bases/base64'
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
  | { [key: number]: JsonValue }

export type IpldValue =
  | JsonValue
  | CID
  | Uint8Array
  | Array<IpldValue>
  | { [key: string]: IpldValue }
  | { [key: number]: IpldValue }

const dagJsonCid = z.object({
  '/': z.string(),
})

const dagJsonBytes = z.object({
  '/': z.object({
    bytes: z.string(),
  }),
})

const dagJsonVal = z.union([dagJsonCid, dagJsonBytes])
const dagJsonValStrict = z.union([dagJsonCid.strict(), dagJsonBytes.strict()])

export const jsonToIpldValue = (val: JsonValue): IpldValue => {
  // check for dag json values
  if (check.is(val, dagJsonVal)) {
    if (!check.is(val, dagJsonValStrict)) {
      // enforce strictly. don't allow other values in dag-json formatted fields
      throw new Error(`improperly formatted dag-json: ${val}`)
    }
    if (check.is(val, dagJsonCid)) {
      return CID.parse(val['/'])
    }
    return base64.decode(`m${val['/'].bytes}`) // add mbase prefix according to dag-json code
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => jsonToIpldValue(item))
  }
  if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = jsonToIpldValue(val[key])
    }
    return toReturn
  }
  return val
}

export const ipldValueToJson = (val: IpldValue): JsonValue => {
  // convert bytes
  if (check.is(val, schema.bytes)) {
    return {
      '/': {
        bytes: base64.encode(val).slice(1), // no mbase prefix (taken from dag-json code)
      },
    }
  }
  // convert cids
  if (check.is(val, schema.cid)) {
    return val.toJSON()
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => ipldValueToJson(item))
  }
  if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldValueToJson(val[key])
    }
    return toReturn
  }
  return val as JsonValue
}
