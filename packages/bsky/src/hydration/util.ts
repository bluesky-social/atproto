import { AtUri } from '@atproto/syntax'
import { jsonToLex } from '@atproto/lexicon'
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
  takenDown: boolean
}

export const parseRecord = <T>(
  entry: Record,
  includeTakedowns: boolean,
): RecordInfo<T> | undefined => {
  if (!includeTakedowns && entry.takenDown) {
    return undefined
  }
  const record = parseRecordBytes<T>(entry.record)
  const cid = parseCid(entry.cid)
  const indexedAt = entry.indexedAt?.toDate()
  if (!record || !cid) return
  return { record, cid, indexedAt, takenDown: entry.takenDown }
}

export const parseRecordBytes = <T>(
  bytes: Uint8Array | undefined,
): T | undefined => {
  const parsed = parseJsonBytes(bytes)
  return jsonToLex(parsed) as T
}

export const parseJsonBytes = (
  bytes: Uint8Array | undefined,
): JSON | undefined => {
  if (!bytes || bytes.byteLength === 0) return
  const parsed = JSON.parse(ui8.toString(bytes, 'utf8'))
  return parsed ?? undefined
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

export const didFromUri = (uri: string) => {
  return new AtUri(uri).hostname
}
