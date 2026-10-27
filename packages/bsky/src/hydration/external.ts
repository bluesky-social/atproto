import { performance } from 'node:perf_hooks'
import { chunkArray } from '@atproto/common'
import {
  type AtUriString,
  type DidString,
  type InferInput,
  type NsidString,
  type RecordSchema,
  type TypedLexMap,
  isDidString,
  isTypedLexMap,
  lexParseJsonBytes,
} from '@atproto/lex'
import { parseAtUriString } from '@atproto/syntax'
import type { DataPlaneClient } from '../data-plane/client/index.js'
import { site } from '../lexicons/index.js'
import {
  type RecordLookupResult,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import {
  type ExternalHydrationOutcome,
  type ExternalHydrationRoot,
  type ExternalHydrationWork,
  type HydrationXrpcEndpoint,
  events,
} from '../telemetry/events.js'
import { recordUriOf, uriToDid } from '../util/uris.js'
import {
  type SiteStandardDocumentRecord,
  type SiteStandardPublicationRecord,
  isExternalEmbedType,
  isRecordWithMediaType,
} from '../views/types.js'
import type { Actors } from './actor.js'
import type { Post, Posts } from './feed.js'
import type { Labels } from './label.js'
import {
  HydrationMap,
  type ItemRef,
  type RecordInfo,
  parseDate,
  safeTakedownRef,
} from './util.js'

/** Generic record bodies are decoded, but not validated against a Lexicon. */
export type ExternalRecord = RecordInfo<TypedLexMap>
export type ExternalRecords = HydrationMap<AtUriString, ExternalRecord>
/** Keyed by `genericRecordKey({ uri, cid })` to retain versions of a URI. */
export type ExternalRecordsByRef = HydrationMap<ExactRecordKey, ExternalRecord>
export type ExternalRecordBacklinks = HydrationMap<AtUriString, AtUriString[]>

export type AtmosphereActivityItem = {
  uri: AtUriString
  sortedAt: Date
}

export type AtmosphereTimeline = {
  items: AtmosphereActivityItem[]
  cursor?: string
}

export type AtmosphereBacklinks = {
  backlinks: AtmosphereActivityItem[]
  cursor?: string
}

export type ExternalRecordBacklinkCounts = HydrationMap<
  AtUriString,
  Partial<Record<NsidString, number>>
>

export type AtmosphereBacklinksByActor = {
  backlinks: HydrationMap<AtUriString, AtUriString[]>
  truncated: boolean
}

declare const exactRecordKeySymbol: unique symbol

/**
 * A version-exact `${uri}@${cid}` key, only produced by `genericRecordKey` for
 * a ref with a CID, so it can be parsed back by `parseGenericRecordKey`.
 */
export type ExactRecordKey = string & { [exactRecordKeySymbol]: true }

export type SiteStandardDocument = RecordInfo<SiteStandardDocumentRecord>
export type SiteStandardPublication = RecordInfo<SiteStandardPublicationRecord>

export type ExternalHydrationLevel = 'basic' | 'detailed'

/**
 * Options for external hydration traversals. `hydration` picks one level for
 * the whole traversal (default `'detailed'`): `'basic'` hydrates renderable
 * content, moderation and aggregate backlink counts; `'detailed'` also samples
 * social-preview backlinks and hydrates their records and participants. The
 * remaining fields are traversal state shared by nested passes.
 */
export type ExternalHydrationOptions = {
  hydration?: ExternalHydrationLevel
  seenRecordKeys?: Set<string>
  hydrationPass?: number
  hydrationMetrics?: ExternalHydrationTracker
}

export class ExternalHydrator {
  static readonly MAX_BACKLINK_PREVIEWS = 3
  static readonly MAX_BACKLINK_GALLERY_ITEMS = 10
  static readonly MAX_BACKLINK_FANOUT = 8
  /** Hard cap on generic batches per traversal, counting the root as pass 1. */
  static readonly MAX_EXTERNAL_HYDRATION_PASSES = 8
  /**
   * Entries per generic record RPC. The dataplane rejects larger URI lookups;
   * exact-ref lookups use the same bound defensively.
   */
  static readonly MAX_RECORDS_PER_REQUEST = 100
  /**
   * Target URIs per backlink-count RPC. The dataplane requires between 1 and
   * 100; this is a separate limit from `MAX_RECORDS_PER_REQUEST`.
   */
  static readonly MAX_BACKLINK_COUNT_TARGETS_PER_REQUEST = 100

  constructor(public dataplane: DataPlaneClient) {}

  /**
   * Fetch exact record versions; unavailable records are represented by null.
   * Large inputs are fetched in sequential bounded requests; any failed request
   * rejects the whole call.
   */
  async getRecordsByRef(
    refs: Required<ItemRef>[],
    includeTakedowns = false,
  ): Promise<ExternalRecordsByRef> {
    const map: ExternalRecordsByRef = new HydrationMap()
    for (const chunk of chunkArray(
      refs,
      ExternalHydrator.MAX_RECORDS_PER_REQUEST,
    )) {
      const res = await this.dataplane.getRecordsByRef({ refs: chunk })
      // Results are positional within each request.
      for (let i = 0; i < chunk.length; i++) {
        map.set(
          genericRecordKey(chunk[i]),
          parseGenericRecord(res.results[i], includeTakedowns) ?? null,
        )
      }
    }
    return map
  }

  /**
   * Fetch the latest indexed versions without collection-specific validation.
   * Large inputs are fetched in sequential bounded requests; any failed request
   * rejects the whole call.
   */
  async getRecordsByURI(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<ExternalRecords> {
    const map: ExternalRecords = new HydrationMap()
    for (const chunk of chunkArray(
      uris,
      ExternalHydrator.MAX_RECORDS_PER_REQUEST,
    )) {
      const res = await this.dataplane.getRecordsByURI({ uris: chunk })
      // Results are positional within each request.
      for (let i = 0; i < chunk.length; i++) {
        map.set(
          chunk[i],
          parseGenericRecord(res.results[i], includeTakedowns) ?? null,
        )
      }
    }
    return map
  }

  /** Fetch a page of activity refs for subsequent generic record hydration. */
  async getAtmosphereTimeline(
    viewerDid: DidString,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<AtmosphereTimeline> {
    const res = await this.dataplane.getAtmosphereTimeline({
      viewerDid,
      ...opts,
    })
    return {
      items: res.items.map((item) => ({
        uri: item.uri as AtUriString,
        sortedAt: parseDate(item.sortedAt) ?? new Date(0),
      })),
      cursor: res.cursor || undefined,
    }
  }

  /**
   * Fetch source-record counts, optionally restricted to one collection. Large
   * inputs are fetched in sequential bounded requests; any failed request
   * rejects the whole call.
   */
  async getAtmosphereBacklinkCounts(
    targetUris: AtUriString[],
    collection?: NsidString,
  ): Promise<ExternalRecordBacklinkCounts> {
    const map: ExternalRecordBacklinkCounts = new HydrationMap()
    for (const chunk of chunkArray(
      targetUris,
      ExternalHydrator.MAX_BACKLINK_COUNT_TARGETS_PER_REQUEST,
    )) {
      const res = await this.dataplane.getAtmosphereBacklinkCounts({
        targetUris: chunk,
        collection,
      })
      for (const result of res.results) {
        map.set(
          result.targetUri as AtUriString,
          Object.fromEntries(
            Object.entries(result.counts).map(([nsid, count]) => [
              nsid,
              Number(count),
            ]),
          ),
        )
      }
    }
    return map
  }

  /** Fetch a page of source records linking to a target. */
  async getAtmosphereBacklinks(
    targetUri: AtUriString,
    collection: NsidString,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<AtmosphereBacklinks> {
    const res = await this.dataplane.getAtmosphereBacklinks({
      targetUri,
      collection,
      ...opts,
    })
    return {
      backlinks: res.backlinks.map((backlink) => ({
        uri: backlink.uri as AtUriString,
        sortedAt: parseDate(backlink.sortedAt) ?? new Date(0),
      })),
      cursor: res.cursor || undefined,
    }
  }

  /** Fetch an actor's links per target, retaining the batch truncation flag. */
  async getAtmosphereBacklinksByActor(
    targetUris: AtUriString[],
    actorDid: DidString,
    collection: NsidString,
  ): Promise<AtmosphereBacklinksByActor> {
    const backlinks: AtmosphereBacklinksByActor['backlinks'] =
      new HydrationMap()
    if (!targetUris.length) return { backlinks, truncated: false }

    const res = await this.dataplane.getAtmosphereBacklinksByActor({
      targetUris,
      actorDid,
      collection,
    })
    for (const result of res.results) {
      backlinks.set(
        result.targetUri as AtUriString,
        result.uris as AtUriString[],
      )
    }
    return { backlinks, truncated: res.truncated }
  }
}

/**
 * Composes the lookup key for a ref: the bare URI for a latest-version lookup,
 * or `${uri}@${cid}` for an exact version. A single hydration batch can pull
 * several versions of one URI (different posts pinning different cids), so
 * exact maps need the composite for O(1) version-exact lookups. The two forms
 * never collide, so latest and exact lookups can share one traversal set.
 *
 * Throws on an empty CID rather than treating it as a latest lookup.
 */
export function genericRecordKey(ref: Required<ItemRef>): ExactRecordKey
export function genericRecordKey(ref: ItemRef): string
export function genericRecordKey({ uri, cid }: ItemRef): string {
  if (cid === undefined) return uri
  if (!cid) throw new Error(`Empty CID in record key for ${uri}`)
  return `${uri}@${cid}`
}

/**
 * Recover the URI and CID from an exact record key, splitting at the last `@`.
 * Throws if either part is missing. Components are trusted, not revalidated.
 */
export function parseGenericRecordKey(key: ExactRecordKey): Required<ItemRef> {
  const at = key.lastIndexOf('@')
  if (at <= 0 || at === key.length - 1) {
    throw new Error(`Malformed exact record key: ${key}`)
  }
  return {
    uri: key.slice(0, at) as AtUriString,
    cid: key.slice(at + 1),
  }
}

/**
 * Null generic external records (in both the URI-keyed and exact-ref maps,
 * keeping their keys) that are taken down by an actionable label, unless
 * takedowns are included, or whose owner is explicitly unavailable. Applies to
 * each record independently; counts and other records are unaffected.
 */
export function actionExternalRecordTakedowns(
  {
    externalRecords,
    externalRecordsByRef,
    actors,
    labels,
  }: {
    externalRecords?: ExternalRecords
    externalRecordsByRef?: ExternalRecordsByRef
    actors?: Actors
    labels?: Labels
  },
  includeTakedowns?: boolean,
): void {
  // An absent actor entry was not hydrated; only `null` means unavailable.
  const isHidden = (uri: AtUriString) =>
    actors?.get(uriToDid(uri)) === null ||
    (!includeTakedowns && labels?.get(uri)?.isTakendown)
  for (const [uri, info] of externalRecords ?? []) {
    if (!info || !isHidden(uri)) continue
    externalRecords?.set(uri, null)
    externalRecordsByRef?.set(genericRecordKey({ uri, cid: info.cid }), null)
  }
  // Every exact version is checked on its own; versions are never collapsed.
  for (const [key, info] of externalRecordsByRef ?? []) {
    if (info && isHidden(parseGenericRecordKey(key).uri)) {
      externalRecordsByRef?.set(key, null)
    }
  }
}

/**
 * Generic lookup work of one external hydration traversal, shared by reference
 * through its nested passes. `capped` records hitting the pass limit; `partial`
 * records a recovered best-effort dependency failure.
 */
export type ExternalHydrationTracker = ExternalHydrationWork & {
  capped: boolean
  partial: boolean
  /**
   * Internal: set by the traversal's first dependency discovery, whose refs
   * are its roots.
   */
  rootsCounted: boolean
}

/**
 * Run `fn` with the caller's tracker, or as the owner of a new traversal when
 * there is none. Only the owner reports, once, including on failure, with the
 * context's XRPC endpoint (`'unknown'` if unset) and the traversal's wall time. A
 * returned traversal is `capped` if it hit the pass limit, else `partial` if
 * it recovered from a dependency failure. Owners that completed report when
 * they scheduled a batch or inspected roots (even prehydrated or unavailable
 * ones); only genuinely empty successful calls are not reported. Other
 * outcomes always are.
 */
export async function trackExternalHydration<T>(
  root: ExternalHydrationRoot,
  xrpcEndpoint: HydrationXrpcEndpoint | undefined,
  hydrationMetrics: ExternalHydrationTracker | undefined,
  fn: (hydrationMetrics: ExternalHydrationTracker) => Promise<T>,
): Promise<T> {
  if (hydrationMetrics) return fn(hydrationMetrics)
  const owned: ExternalHydrationTracker = {
    recordLookups: 0,
    batches: 0,
    maxPass: 0,
    roots: 0,
    rootsResolved: 0,
    dependencies: 0,
    dependenciesResolved: 0,
    capped: false,
    partial: false,
    rootsCounted: false,
  }
  let outcome: ExternalHydrationOutcome = 'failed'
  const start = performance.now()
  try {
    const state = await fn(owned)
    outcome = owned.capped ? 'capped' : owned.partial ? 'partial' : 'completed'
    return state
  } finally {
    if (owned.batches > 0 || owned.roots > 0 || outcome !== 'completed') {
      events.externalHydrationTraversal({
        xrpcEndpoint: xrpcEndpoint ?? 'unknown',
        root,
        outcome,
        durationMs: performance.now() - start,
        recordLookups: owned.recordLookups,
        batches: owned.batches,
        maxPass: owned.maxPass,
        roots: owned.roots,
        rootsResolved: owned.rootsResolved,
        dependencies: owned.dependencies,
        dependenciesResolved: owned.dependenciesResolved,
      })
    }
  }
}

function parseGenericRecord(
  result: RecordLookupResult | undefined,
  includeTakedowns: boolean,
): ExternalRecord | undefined {
  if (
    result?.status !== RecordLookupStatus.FOUND &&
    !(includeTakedowns && result?.status === RecordLookupStatus.TAKEN_DOWN)
  ) {
    return undefined
  }
  const entry = result.record
  if (!entry?.cid || !entry.record.byteLength) return undefined
  if (!includeTakedowns && entry.takenDown) return undefined

  let record: ReturnType<typeof lexParseJsonBytes>
  try {
    record = lexParseJsonBytes(entry.record, { strict: false })
  } catch {
    return undefined
  }
  if (!isTypedLexMap(record)) return undefined

  return {
    record,
    cid: entry.cid,
    sortedAt: parseDate(entry.sortedAt) ?? new Date(0),
    indexedAt: parseDate(entry.indexedAt) ?? new Date(0),
    takedownRef: safeTakedownRef(entry),
  }
}

const siteStandardKind = (
  uri: string,
): 'documents' | 'publications' | undefined => {
  const parsed = parseAtUriString(uri)
  if (!parsed.success) return undefined
  switch (parsed.value.collection) {
    case site.standard.document.$type:
      return 'documents'
    case site.standard.publication.$type:
      return 'publications'
    default:
      return undefined
  }
}

/**
 * Generic record bodies are unvalidated, so check them against the Lexicon
 * before exposing typed fields. Parse mode is not used, to preserve the
 * stored record as-is.
 */
const matchRecordInfo = <TSchema extends RecordSchema>(
  schema: TSchema,
  info: ExternalRecord | null | undefined,
): RecordInfo<InferInput<TSchema>> | null =>
  info && schema.$matches(info.record, { strict: false })
    ? { ...info, record: info.record }
    : null

export type AssociatedSiteStandardRecord<T> = {
  ref: { uri: AtUriString; cid: string }
  info: T
}

/**
 * Select one pinned embed root. Legacy publication-first pairs may put their
 * document second; no other authored refs participate in hydration.
 */
export function getExternalRootRef(
  refs: readonly Required<ItemRef>[] | undefined,
): Required<ItemRef> | undefined {
  let root = refs?.[0]
  if (!root) return undefined
  if (siteStandardKind(root.uri) === 'publications') {
    const second = refs?.[1]
    if (second && siteStandardKind(second.uri) === 'documents') root = second
  }
  return isHydratableAssociatedRef(root) ? root : undefined
}

/** Select a pinned Standard.site root and its derived publication, if needed. */
export function getSiteStandardRecordsFromRefs(
  associatedRefs: readonly Required<ItemRef>[] | undefined,
  records: ExternalRecordsByRef | undefined,
  dependencies?: ExternalRecords,
): {
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  publication: AssociatedSiteStandardRecord<SiteStandardPublication> | undefined
} {
  const empty = { document: undefined, publication: undefined }
  const ref = getExternalRootRef(associatedRefs)
  if (!ref) return empty
  const info = records?.get(genericRecordKey(ref))
  if (siteStandardKind(ref.uri) === 'publications') {
    const publication = matchRecordInfo(site.standard.publication.main, info)
    return publication
      ? { document: undefined, publication: { ref, info: publication } }
      : empty
  }
  if (siteStandardKind(ref.uri) !== 'documents') return empty
  const document = matchRecordInfo(site.standard.document.main, info)
  if (!document) return empty
  const documentSelection = { ref, info: document }
  const docSite = document.record.site
  if (!docSite.startsWith('at://')) {
    return { document: documentSelection, publication: undefined }
  }
  const uri = recordUriOf(docSite, site.standard.publication.$type)
  if (!uri) return empty
  const publication = matchRecordInfo(
    site.standard.publication.main,
    dependencies?.get(uri),
  )
  if (!publication) return empty
  return {
    document: documentSelection,
    publication: { ref: { uri, cid: publication.cid }, info: publication },
  }
}

const externalAssociatedRefs = (
  post: Post['record'],
): { uri: AtUriString; cid: string }[] => {
  const embed = post?.embed
  if (!embed) return []
  if (isExternalEmbedType(embed)) {
    return embed.external.associatedRefs ?? []
  }
  if (isRecordWithMediaType(embed) && isExternalEmbedType(embed.media)) {
    return embed.media.external.associatedRefs ?? []
  }
  return []
}

/**
 * An exact ref needs a nonempty CID and a complete record URI in a DID repo,
 * so malformed refs are skipped instead of becoming latest lookups.
 */
const isHydratableAssociatedRef = (ref: {
  uri: string
  cid: string
}): boolean => {
  if (!ref.cid) return false
  const parsed = parseAtUriString(ref.uri)
  if (!parsed.success) return false
  const { authority, collection, rkey, query, hash } = parsed.value
  return (
    isDidString(authority) &&
    !!collection &&
    !!rkey &&
    query === undefined &&
    hash === undefined
  )
}

/** Collect one root per post across all layers, deduped by exact ref. */
export const externalAssociatedRefsFromPosts = (
  ...postLayers: Posts[]
): Required<ItemRef>[] => {
  const seen = new Set<string>()
  const out: Required<ItemRef>[] = []
  for (const layer of postLayers) {
    for (const item of layer.values()) {
      if (!item) continue
      const ref = getExternalRootRef(externalAssociatedRefs(item.record))
      if (!ref) continue
      const key = genericRecordKey(ref)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ uri: ref.uri, cid: ref.cid })
    }
  }
  return out
}
