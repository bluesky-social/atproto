import { jsonToLex } from '@atproto/lexicon'
import { Timestamp } from '@bufbuild/protobuf'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { Record } from '../data-plane/gen/bsky_pb'

export class HydrationMap<T> extends Map<string, T | null> {
  merge(map: HydrationMap<T>): HydrationMap<T> {
    map.forEach((val, key) => {
      this.set(key, val)
    })
    return this
  }
}

export type RecordInfo<T> = {
  record: T
  cid: CID
  indexedAt?: Date
}

export const parseRecord = <T>(entry: Record): RecordInfo<T> | undefined => {
  const record = parseRecordBytes<T>(entry.record)
  const cid = parseCid(entry.cid)
  const indexedAt = parseTimestamp(entry.indexedAt)
  if (!record || !cid) return
  return { record, cid, indexedAt }
}

export const parseRecordBytes = <T>(
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
