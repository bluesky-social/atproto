import * as ui8 from 'uint8arrays'
import { RecordSchema, lexParse } from '@atproto/lex'
import { Cid, LexValue, TypedLexMap, isPlainObject } from '@atproto/lex-data'
import { AtUri, AtUriString } from '@atproto/syntax'
import { app, chat, com } from '../lexicons/index.js'
import { Record } from '../proto/bsky_pb'

export class HydrationMap<T, K> extends Map<K, T | null> implements Merges {
  merge(map: HydrationMap<T, K>): this {
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

export const mergeNestedMaps = <
  V extends HydrationMap<unknown, unknown>,
  K extends string,
>(
  mapA?: HydrationMap<V, K>,
  mapB?: HydrationMap<V, K>,
): HydrationMap<V, K> | undefined => {
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

export const mergeManyMaps = <T, K extends string = string>(
  ...maps: HydrationMap<T, K>[]
) => {
  return maps.reduce(mergeMaps, undefined as HydrationMap<T, K> | undefined)
}

export type ItemRef = { uri: AtUriString; cid?: string }

export const parseRecord = <T extends { $type: string }>(
  entry: Record,
  includeTakedowns: boolean,
): RecordInfo<T> | undefined => {
  if (!includeTakedowns && entry.takenDown) {
    return undefined
  }
  const record = parseJsonBytes<T>(entry.record)
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

export const KNOWN_RECORD_TYPES = new Map<string, RecordSchema>(
  [
    // Note: maybe we can generate this by "exploring" the whole app, com and chat namespaces ?
    app.bsky.actor.profile.main,
    app.bsky.actor.status.main,
    app.bsky.feed.generator.main,
    app.bsky.feed.like.main,
    app.bsky.feed.post.main,
    app.bsky.feed.postgate.main,
    app.bsky.feed.repost.main,
    app.bsky.feed.threadgate.main,
    app.bsky.graph.block.main,
    app.bsky.graph.follow.main,
    app.bsky.graph.list.main,
    app.bsky.graph.listblock.main,
    app.bsky.graph.listitem.main,
    app.bsky.graph.starterpack.main,
    app.bsky.graph.verification.main,
    app.bsky.labeler.service.main,
    app.bsky.notification.declaration.main,
    chat.bsky.actor.declaration.main,
    com.atproto.lexicon.schema.main,
  ].map((schema) => [schema.$type, schema]),
)

const isValidRecord = (value: LexValue) => {
  if (!isPlainObject(value) || typeof value.$type !== 'string') {
    return false
  }

  const schema = KNOWN_RECORD_TYPES.get(value.$type)
  if (!schema) {
    return false
  }

  return schema.$matches(value)
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

export const parseCid = (cidStr: string | undefined): Cid | undefined => {
  if (!cidStr || cidStr.length === 0) return
  try {
    return parseCid(cidStr)
  } catch {
    return
  }
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
