import { AtUri } from '@atproto/syntax'
import { jsonToLex } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { lexicons } from '../lexicon/lexicons'
import { Record } from '../proto/bsky_pb'

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
  cid: string
  sortedAt: Date
  takedownRef: string | undefined
}

export const parseRecord = <T>(
  entry: Record,
  includeTakedowns: boolean,
): RecordInfo<T> | undefined => {
  if (!includeTakedowns && entry.takenDown) {
    return undefined
  }
  const record = parseRecordBytes<T>(entry.record)
  const cid = entry.cid
  const sortedAt = entry.sortedAt?.toDate() ?? new Date(0)
  if (!record || !cid) return
  if (!isValidRecord(record)) {
    return
  }
  return {
    record,
    cid,
    sortedAt,
    takedownRef: safeTakedownRef(entry),
  }
}

const isValidRecord = (json: unknown) => {
  const lexRecord = jsonToLex(json)
  if (typeof lexRecord?.['$type'] !== 'string') {
    return false
  }
  try {
    lexicons.assertValidRecord(lexRecord['$type'], lexRecord)
    return true
  } catch {
    return false
  }
}

// @NOTE not parsed into lex format, so will not match lexicon record types on CID and blob values.
export const parseRecordBytes = <T>(
  bytes: Uint8Array | undefined,
): T | undefined => {
  return parseJsonBytes(bytes) as T
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

export const urisByCollection = (uris: string[]): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  for (const uri of uris) {
    const collection = new AtUri(uri).collection
    const items = result.get(collection) ?? []
    items.push(uri)
    result.set(collection, items)
  }
  return result
}

export const split = <T>(
  items: T[],
  predicate: (item: T) => boolean,
): [T[], T[]] => {
  const yes: T[] = []
  const no: T[] = []
  for (const item of items) {
    if (predicate(item)) {
      yes.push(item)
    } else {
      no.push(item)
    }
  }
  return [yes, no]
}

export const safeTakedownRef = (obj?: {
  takenDown: boolean
  takedownRef: string
}): string | undefined => {
  if (!obj) return
  if (obj.takedownRef) return obj.takedownRef
  if (obj.takenDown) return 'BSKY-TAKEDOWN-UNKNOWN'
}
