import { CID } from 'multiformats/cid'
import { isPureObject } from '../lib/is-object.js'
import { Json } from './json.js'

export { CID }

export function parseLexLink(input: unknown): CID | undefined {
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

export function encodeLexLink(cid: CID): Json {
  return { $link: cid.toString() }
}
