import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { check, schema } from '.'
import { z } from 'zod'

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
