import { Timestamp } from '@bufbuild/protobuf'
import {
  AtUriString,
  Cid,
  InferInput,
  InferOutput,
  LexParseOptions,
  LexValue,
  RecordSchema,
  Schema,
  TypedLexMap,
  ValidateOptions,
  lexParseJsonBytes,
  parseCidSafe,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { Record as RecordEntry } from '../proto/bsky_pb'

const PARSE_OPTIONS: LexParseOptions & ValidateOptions = {
  strict: false,
}

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

export type RecordInfo<T extends TypedLexMap> = {
  record: T
  cid: string
  sortedAt: Date
  indexedAt: Date
  takedownRef: string | undefined
}

export const mergeMaps = <V extends HydrationMap<any, any>>(
  mapA?: V,
  mapB?: V,
): V | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA
  return mapA.merge(mapB)
}

export const mergeNestedMaps = <K, V extends HydrationMap<any, any>>(
  mapA?: HydrationMap<K, V>,
  mapB?: HydrationMap<K, V>,
): HydrationMap<K, V> | undefined => {
  if (!mapA) return mapB
  if (!mapB) return mapA

  for (const [key, map] of mapB) {
    const merged = mergeMaps(mapA.get(key) ?? undefined, map ?? undefined)
    mapA.set(key, merged ?? null)
  }

  return mapA
}

export const mergeManyMaps = <K, T>(...maps: HydrationMap<K, T>[]) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<K, T> | undefined)
}

export type ItemRef = { uri: AtUriString; cid?: string }

export function parseRecord<TSchema extends RecordSchema>(
  recordSchema: TSchema,
  recordEntry: RecordEntry,
  includeTakedowns: boolean,
): RecordInfo<InferInput<TSchema>> | undefined {
  if (!includeTakedowns && recordEntry.takenDown) {
    return undefined
  }

  const cid = recordEntry.cid
  if (!cid) {
    return undefined
  }

  if (recordEntry.record.byteLength === 0) {
    return undefined
  }

  const record = lexParseJsonBytes(recordEntry.record, PARSE_OPTIONS)
  if (!record) {
    return undefined
  }

  // @NOTE We cannot use parse mode here. We must return the original to ensure
  // that the caller gets the same data as what is stored in the PDS (in case of
  // records). This is important because the receiver of the data should be able
  // to compute the right record CID.

  if (!recordSchema.$matches(record, PARSE_OPTIONS)) {
    return undefined
  }

  return {
    record,
    cid,
    sortedAt: parseDate(recordEntry.sortedAt) ?? new Date(0),
    indexedAt: parseDate(recordEntry.indexedAt) ?? new Date(0),
    takedownRef: safeTakedownRef(recordEntry),
  }
}

/**
 * Decodes binary data containing a JSON representation of a Lex value, and
 * validates it against the provided schema, in parse mode (i.e., allowing
 * coercion & defaults).
 *
 * Returns undefined if the input is empty (from dataplane's empty value
 * convention), or if the validation fails.
 */
export const parseJsonBytes = <TSchema extends Schema<LexValue>>(
  schema: TSchema,
  bytes: Uint8Array | undefined,
): InferOutput<TSchema> | undefined => {
  if (!bytes || bytes.byteLength === 0) return undefined
  const value = lexParseJsonBytes(bytes, PARSE_OPTIONS)
  const result = schema.safeParse(value, PARSE_OPTIONS)
  return result.success ? result.value : undefined
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

export const parseDate = (
  timestamp: Timestamp | undefined,
): Date | undefined => {
  if (!timestamp) return undefined
  const date = timestamp.toDate()
  // Check for year 1 (0001-01-01 00:00:00 UTC) which is -62135596800000ms from epoch.
  // The Go dataplane gives us those values as they come from the Go zero-value for dates.
  if (date.getTime() === -62135596800000) return undefined
  return date
}

export const urisByCollection = <T extends string>(
  uris: Iterable<T>,
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
