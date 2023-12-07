import { jsonToLex } from '@atproto/lexicon'
import { Timestamp } from '@bufbuild/protobuf'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'

export class HydrationMap<T> extends Map<string, T | null> {
  merge(map: HydrationMap<T>): HydrationMap<T> {
    map.forEach((val, key) => {
      this.set(key, val)
    })
    return this
  }
}

export const parseRecord = <T>(
  bytes: Uint8Array | undefined,
): T | undefined => {
  if (!bytes || bytes.byteLength === 0) return
  const parsed = JSON.parse(ui8.toString(bytes, 'utf8'))
  if (!parsed) return
  return jsonToLex(parsed) as T
}

export const parseString = (str: string | undefined): string | undefined => {
  return str && str.length > 0 ? str : undefined
}

export const parseCid = (cidStr: string | undefined): CID | undefined => {
  if (!cidStr || cidStr.length === 0) return
  try {
    return CID.parse(cidStr)
  } catch {
    return
  }
}

export const parseTimestamp = (ts: Timestamp | undefined): Date | undefined => {
  if (!ts) return undefined
  const ms = Math.floor(ts.nanos / 1000)
  return new Date(ms)
}
