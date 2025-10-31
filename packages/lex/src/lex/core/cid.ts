import { CID } from 'multiformats/cid'
import { isPlainObject } from '../lib/is-object.js'
import { Json } from './json.js'

export { CID }

export function parseCidString(input: string): CID | undefined {
  try {
    return CID.parse(input)
  } catch {
    return undefined
  }
}

export function parseLexLink(input: unknown): CID | undefined {
  if (
    isPlainObject(input) &&
    typeof input.$link === 'string' &&
    Object.keys(input).length === 1
  ) {
    return parseCidString(input.$link)
  }

  return undefined
}

export function encodeLexLink(cid: CID): Json {
  return { $link: cid.toString() }
}
