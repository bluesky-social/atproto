import { CID } from 'multiformats/cid'
import { isPureObject } from '../core.js'

export { CID }

export function parseIpldLink(input: unknown): CID | null {
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

  return null
}
