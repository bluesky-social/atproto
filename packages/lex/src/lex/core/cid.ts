import { CID } from 'multiformats/cid'
import { isPureObject } from '../core.js'

export { CID }

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

export function encodeIpldLink(cid: CID): { $link: string } {
  return { $link: cid.toString() }
}
