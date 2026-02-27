import * as ui8 from 'uint8arrays'
import { l, lexParse } from '@atproto/lex'
import {
  Cid,
  LexValue,
  TypedLexMap,
  isPlainObject,
  parseCidSafe,
} from '@atproto/lex-data'
import { AtUri, AtUriString } from '@atproto/syntax'
import * as lexicons from '../lexicons/index.js'
import { Record } from '../proto/bsky_pb'

export class HydrationMap<K, T> extends Map<K, T | null> implements Merges {
  merge(map: HydrationMap<K, T>): this {
    for (const [key, val] of map) {
      this.set(key, val)
    }
    return this
  }
}

export interface Merges {
  merge<T extends this>(map: T): this
}

export type RecordInfo<T extends { $type: string }> = {
  record: T & TypedLexMap
  cid: string
  sortedAt: Date
  indexedAt: Date
  takedownRef: string | undefined
}

export const mergeMaps = <V extends HydrationMap<unknown, unknown>>(
  mapA?: V,
  mapB?: V,
): V | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

export const mergeNestedMaps = <K, V extends HydrationMap<unknown, unknown>>(
  mapA?: HydrationMap<K, V>,
  mapB?: HydrationMap<K, V>,
): HydrationMap<K, V> | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA

  for (const [key, map] of mapB) {
    const merged = mergeMaps(mapA.get(key) ?? undefined, map ?? undefined) as
      | V
      | undefined
    mapA.set(key, merged ?? null)
  }

  return mapA
}

export const mergeManyMaps = <K, T>(...maps: HydrationMap<K, T>[]) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<K, T> | undefined)
}

export type ItemRef = { uri: AtUriString; cid?: string }

export const parseRecord = <T extends { $type: string }>(
  entry: Record,
  includeTakedowns: boolean,
): RecordInfo<T> | undefined => {
  if (!includeTakedowns && entry.takenDown) {
    return undefined
  }

  const cid = entry.cid
  if (!cid) return

  const record = parseJsonBytes<T>(entry.record)
  if (!record || !isValidRecord(record)) return

  return {
    record,
    cid,
    sortedAt: entry.sortedAt?.toDate() ?? new Date(0),
    indexedAt: entry.indexedAt?.toDate() ?? new Date(0),
    takedownRef: safeTakedownRef(entry),
  }
}

/**
 * Recursively enumerate all RecordSchemas in a namespace.
 */
function* enumerateRecordSchemas(namespace: {
  [key: string]: unknown
}): Generator<l.RecordSchema> {
  for (const key of Object.keys(namespace)) {
    if (key === '$defs') {
      const { main } = (namespace as { $defs: { main?: unknown } })[key]
      if (main && main instanceof l.RecordSchema) {
        yield main
      }
    } else if (key.charCodeAt(0) !== 36) {
      // skip keys starting with '$' (generated utils)
      const val = namespace[key]
      if (val && typeof val === 'object') {
        yield* enumerateRecordSchemas(val as { [key: string]: unknown })
      }
    }
  }
}

export const KNOWN_RECORD_TYPES = new Map<string, l.RecordSchema>(
  Array.from(enumerateRecordSchemas(lexicons), (s) => [s.$type, s]),
)

const isValidRecord = (value: LexValue): boolean => {
  if (!isPlainObject(value) || typeof value.$type !== 'string') {
    return false
  }

  const schema = KNOWN_RECORD_TYPES.get(value.$type)
  if (!schema) {
    return false
  }

  return schema.matches(value)
}

export const parseJsonBytes = <T extends LexValue = LexValue>(
  bytes: Uint8Array | undefined,
): T | undefined => {
  if (!bytes || bytes.byteLength === 0) return undefined
  return lexParse<T>(ui8.toString(bytes, 'utf8'))
}

export const parseString = <T extends string | undefined>(
  str: undefined | string,
): T | undefined => {
  return str ? (str as T) : undefined
}

export const parseCid = (cidStr: string | undefined): Cid | null => {
  if (!cidStr) return null
  return parseCidSafe(cidStr)
}

export const urisByCollection = <T extends string>(
  uris: T[],
): Map<string, T[]> => {
  const result = new Map<string, T[]>()
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

export const isActivitySubscriptionEnabled = ({
  post,
  reply,
}: {
  post: boolean
  reply: boolean
}): boolean => post || reply
