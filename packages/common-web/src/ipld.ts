import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | Array<JsonValue>
  | { [key: string]: JsonValue }

export type IpldValue =
  | JsonValue
  | CID
  | Uint8Array
  | Array<IpldValue>
  | { [key: string]: IpldValue }

export const isTypeofObject = <V>(val: V): val is V & object =>
  val != null && typeof val === 'object'

// @NOTE avoiding use of check.is() here only because it makes
// these implementations slow, and they often live in hot paths.

export const jsonToIpld = (val: JsonValue): IpldValue => {
  // walk arrays
  if (Array.isArray(val)) {
    return val.map(jsonToIpld)
  }
  // objects
  if (isTypeofObject(val)) {
    // check for dag json values
    if (typeof val['$link'] === 'string' && Object.keys(val).length === 1) {
      return CID.parse(val['$link'])
    }
    if (typeof val['$bytes'] === 'string' && Object.keys(val).length === 1) {
      return ui8.fromString(val['$bytes'], 'base64')
    }
    // walk plain objects
    const toReturn: { [key: string]: IpldValue } = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = jsonToIpld(val[key])
    }
    return toReturn
  }
  // pass through
  return val
}

export const ipldToJson = (val: IpldValue): JsonValue => {
  // walk arrays
  if (Array.isArray(val)) {
    return val.map((item) => ipldToJson(item))
  }
  // objects
  if (val && typeof val === 'object') {
    // convert bytes
    if (val instanceof Uint8Array) {
      return {
        $bytes: ui8.toString(val, 'base64'),
      }
    }
    // convert cids
    if (isCid(val)) {
      return {
        $link: CID.asCID(val)!.toString(),
      }
    }
    // walk plain objects
    const toReturn: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldToJson(val[key])
    }
    return toReturn
  }
  // pass through
  return val as JsonValue
}

export const ipldEquals = (a: IpldValue, b: IpldValue): boolean => {
  // walk arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false

    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!ipldEquals(a[i], b[i])) return false
    }
    return true
  } else if (Array.isArray(b)) {
    return false
  }

  // objects
  if (isTypeofObject(a)) {
    if (!isTypeofObject(b)) return false

    // check bytes
    if (a instanceof Uint8Array) {
      return b instanceof Uint8Array && ui8.equals(a, b)
    } else if (b instanceof Uint8Array) {
      return false
    }

    // check cids
    if (isCid(a)) {
      return CID.asCID(b)?.equals(CID.asCID(a)!) ?? false
    } else if (isCid(b)) {
      return false
    }

    // walk plain objects
    const aKeys = Object.keys(a)
    if (aKeys.length !== Object.keys(b).length) return false
    for (const key of aKeys) {
      if (!ipldEquals(a[key], b[key])) return false
    }
    return true
  } else if (isTypeofObject(b)) {
    return false
  }

  return a === b
}

export function isCid(value: unknown): value is CID {
  return CID.asCID(value) != null
}
