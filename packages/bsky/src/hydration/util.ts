import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { jsonToLex } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { lexicons } from '../lexicon/lexicons'
import { Record } from '../proto/bsky_pb'

export class HydrationMap<T> extends Map<string, T | null> implements Merges {
  merge(map: HydrationMap<T>): this {
    map.forEach((val, key) => {
      this.set(key, val)
    })
    return this
  }
}

export interface Merges {
  merge<T extends this>(map: T): this
}

type UnknownRecord = { $type: string; [x: string]: unknown }

export type RecordInfo<T extends UnknownRecord> = {
  record: T
  cid: string
  sortedAt: Date
  indexedAt: Date
  takedownRef: string | undefined
}

export const mergeMaps = <V, M extends HydrationMap<V>>(
  mapA?: M,
  mapB?: M,
): M | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

export const mergeNestedMaps = <V, M extends HydrationMap<HydrationMap<V>>>(
  mapA?: M,
  mapB?: M,
): M | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA

  for (const [key, map] of mapB) {
    const merged = mergeMaps(mapA.get(key) ?? undefined, map ?? undefined)
    mapA.set(key, merged ?? null)
  }

  return mapA
}

export const mergeManyMaps = <T>(...maps: HydrationMap<T>[]) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<T> | undefined)
}

export type ItemRef = { uri: string; cid?: string }

export const parseRecord = <T extends UnknownRecord>(
  entry: Record,
  includeTakedowns: boolean,
): RecordInfo<T> | undefined => {
  if (!includeTakedowns && entry.takenDown) {
    return undefined
  }
  const record = parseRecordBytes<T>(entry.record)
  const cid = entry.cid
  const sortedAt = entry.sortedAt?.toDate() ?? new Date(0)
  const indexedAt = entry.indexedAt?.toDate() ?? new Date(0)
  if (!record || !cid) return
  if (!isValidRecord(record)) {
    return
  }
  return {
    record,
    cid,
    sortedAt,
    indexedAt,
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

export const parseJsonBytes = (bytes: Uint8Array | undefined): unknown => {
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
