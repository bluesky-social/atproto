import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'

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

// @NOTE avoiding use of check.is() here only because it makes
// these implementations slow, and they often live in hot paths.

export const jsonToIpld = (val: JsonValue): IpldValue => {
  // walk arrays
  if (Array.isArray(val)) {
    return val.map((item) => jsonToIpld(item))
  }
  // objects
  if (val && typeof val === 'object') {
    // check for dag json values
    if (typeof val['$link'] === 'string' && Object.keys(val).length === 1) {
      return CID.parse(val['$link'])
    }
    if (typeof val['$bytes'] === 'string' && Object.keys(val).length === 1) {
      return ui8.fromString(val['$bytes'], 'base64')
    }
    // walk plain objects
    const toReturn = {}
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
    if (CID.asCID(val)) {
      return {
        $link: (val as CID).toString(),
      }
    }
    // walk plain objects
    const toReturn = {}
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
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!ipldEquals(a[i], b[i])) return false
    }
    return true
  }
  // objects
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    // check bytes
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return ui8.equals(a, b)
    }
    // check cids
    if (CID.asCID(a) && CID.asCID(b)) {
      return CID.asCID(a)?.equals(CID.asCID(b))
    }
    // walk plain objects
    if (Object.keys(a).length !== Object.keys(b).length) return false
    for (const key of Object.keys(a)) {
      if (!ipldEquals(a[key], b[key])) return false
    }
    return true
  }
  return a === b
}
