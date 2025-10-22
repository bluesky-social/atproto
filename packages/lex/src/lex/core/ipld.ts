import { CID } from 'multiformats/cid'
import { isPureObject } from '../lib/is-object.js'
import { Json, JsonScalar } from './json.js'
import { decodeBase64, ui8ToBase64 } from './ui8.js'

export { CID }

export type IpldScalar = JsonScalar | CID | Uint8Array
export type Ipld = IpldScalar | Ipld[] | { [key: string]: Ipld }
export type IpldObject = { [key: string]: Ipld }

export function parseIpldLink(input: unknown): CID | undefined {
  if (
    isPureObject(input) &&
    typeof input.$link === 'string' &&
    Object.keys(input).length === 1
  ) {
    try {
      return CID.parse(input.$link)
    } catch {
      // ignore
    }
  }

  return undefined
}

export function encodeIpldLink(cid: CID): Json {
  return { $link: cid.toString() }
}

export function parseIpldBytes(input: unknown): Uint8Array | undefined {
  if (
    isPureObject(input) &&
    '$bytes' in input &&
    typeof input.$bytes === 'string' &&
    Object.keys(input).length === 1
  ) {
    const value = decodeBase64(input.$bytes)
    if (value) return value
  }

  return undefined
}

export function encodeIpldBytes(bytes: Uint8Array): Json {
  return { $bytes: ui8ToBase64(bytes) }
}
