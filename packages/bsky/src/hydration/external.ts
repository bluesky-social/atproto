import {
  type AtUriString,
  type DidString,
  type InferInput,
  type NsidString,
  type RecordSchema,
  type TypedLexMap,
  isTypedLexMap,
  lexParseJsonBytes,
} from '@atproto/lex'
import { parseAtUriString } from '@atproto/syntax'
import type { DataPlaneClient } from '../data-plane/client/index.js'
import { site } from '../lexicons/index.js'
import { hydrationLogger } from '../logger.js'
import {
  type RecordLookupResult,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import type {
  SiteStandardDocumentRecord,
  SiteStandardPublicationRecord,
} from '../views/types.js'
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

export type SiteStandardDocument = RecordInfo<SiteStandardDocumentRecord>
export type SiteStandardPublication = RecordInfo<SiteStandardPublicationRecord>

/**
 * Keyed by `${uri}@${cid}` — see `genericRecordKey`. A single hydration
 * batch can pull more than one version of the same URI (different posts
 * pinning different cids), so the composite key is needed for O(1)
 * version-exact lookups.
 */
export type SiteStandardDocuments = HydrationMap<
  ExactRecordKey,
  SiteStandardDocument
>
/**
 * Keyed by `${uri}@${cid}`. See `SiteStandardDocuments` for the rationale.
 */
export type SiteStandardPublications = HydrationMap<
  ExactRecordKey,
  SiteStandardPublication
>
export type SiteStandardRecords = {
  documents: SiteStandardDocuments
  publications: SiteStandardPublications
}

export type AssociatedSiteStandardRecord<T> = {
  ref: { uri: AtUriString; cid: string }
  info: T
}

export class ExternalHydrator {
  static readonly MAX_BACKLINK_PREVIEWS = 3
  static readonly MAX_BACKLINK_GALLERY_ITEMS = 10
  static readonly MAX_BACKLINK_FANOUT = 8
  /** Hard cap on generic batches per traversal, counting the root as pass 1. */
  static readonly MAX_EXTERNAL_HYDRATION_PASSES = 8

  constructor(public dataplane: DataPlaneClient) {}

  /** Fetch exact record versions; unavailable records are represented by null. */
  async getRecordsByRef(
    refs: Required<ItemRef>[],
    includeTakedowns = false,
  ): Promise<ExternalRecordsByRef> {
    const map: ExternalRecordsByRef = new HydrationMap()
    if (!refs.length) return map

    const res = await this.dataplane.getRecordsByRef({ refs })
    for (let i = 0; i < refs.length; i++) {
      map.set(
        genericRecordKey(refs[i]),
        parseGenericRecord(res.results[i], includeTakedowns) ?? null,
      )
    }
    return map
  }

  /** Fetch the latest indexed versions without collection-specific validation. */
  async getRecordsByURI(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<ExternalRecords> {
    const map: ExternalRecords = new HydrationMap()
    if (!uris.length) return map

    const res = await this.dataplane.getRecordsByURI({ uris })
    for (let i = 0; i < uris.length; i++) {
      map.set(
        uris[i],
        parseGenericRecord(res.results[i], includeTakedowns) ?? null,
      )
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

  /** Fetch source-record counts, optionally restricted to one collection. */
  async getAtmosphereBacklinkCounts(
    targetUris: AtUriString[],
    collection?: NsidString,
  ): Promise<ExternalRecordBacklinkCounts> {
    const map: ExternalRecordBacklinkCounts = new HydrationMap()
    if (!targetUris.length) return map

    const res = await this.dataplane.getAtmosphereBacklinkCounts({
      targetUris,
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

  /**
   * Fetch exact `site.standard.{document,publication}` versions. Does NOT
   * resolve a document's publication; callers must pin it explicitly.
   */
  async getSiteStandardRecordsByRef(
    refs: ItemRef[],
    includeTakedowns = false,
  ): Promise<SiteStandardRecords> {
    const ssRefs = refs.filter(
      (ref): ref is Required<ItemRef> =>
        !!ref.cid && siteStandardKind(ref.uri) !== undefined,
    )
    const out = emptySiteStandardRecords()
    if (!ssRefs.length) return out

    const records = await this.getRecordsByRef(ssRefs, includeTakedowns)
    for (const [key, info] of records) {
      setSiteStandardRecord(out, parseGenericRecordKey(key).uri, key, info)
    }
    return out
  }

  /**
   * Fetch the latest `site.standard.{document,publication}` versions. The
   * generic record lookup does not follow references, so publications named
   * by the `site` field of the hydrated documents are fetched in a second
   * call.
   */
  async getSiteStandardRecordsByURI(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<SiteStandardRecords> {
    const requested = [...new Set(uris.filter((u) => siteStandardKind(u)))]
    const out = emptySiteStandardRecords()
    if (!requested.length) return out

    await this.addSiteStandardRecordsByURI(out, requested, includeTakedowns)

    // Publications referenced by documents but not already requested.
    const requestedSet = new Set<string>(requested)
    const pubUris = new Set<AtUriString>()
    for (const doc of out.documents.values()) {
      const pubUri = doc && publicationUriFromSite(doc.record.site)
      if (pubUri && !requestedSet.has(pubUri)) pubUris.add(pubUri)
    }
    if (pubUris.size) {
      await this.addSiteStandardRecordsByURI(
        out,
        [...pubUris],
        includeTakedowns,
      )
    }
    return out
  }

  private async addSiteStandardRecordsByURI(
    out: SiteStandardRecords,
    uris: AtUriString[],
    includeTakedowns: boolean,
  ) {
    const records = await this.getRecordsByURI(uris, includeTakedowns)
    for (const [uri, info] of records) {
      // Unavailable records have no CID to key on, so they are left out.
      if (!info) continue
      setSiteStandardRecord(
        out,
        uri,
        genericRecordKey({ uri, cid: info.cid }),
        info,
      )
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

const emptySiteStandardRecords = (): SiteStandardRecords => ({
  documents: new HydrationMap(),
  publications: new HydrationMap(),
})

const siteStandardKind = (
  uri: string,
): keyof SiteStandardRecords | undefined => {
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

/** The AT-URI of the publication a document's `site` field points at. */
const publicationUriFromSite = (value: string): AtUriString | undefined => {
  const parsed = parseAtUriString(value)
  return parsed.success &&
    parsed.value.collection === site.standard.publication.$type
    ? (value as AtUriString)
    : undefined
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

/**
 * Store a generic record in the map matching its collection. Records failing
 * Lexicon validation are stored as null.
 */
const setSiteStandardRecord = (
  out: SiteStandardRecords,
  uri: string,
  key: ExactRecordKey,
  info: ExternalRecord | null | undefined,
) => {
  switch (siteStandardKind(uri)) {
    case 'documents':
      out.documents.set(key, matchRecordInfo(site.standard.document.main, info))
      break
    case 'publications':
      out.publications.set(
        key,
        matchRecordInfo(site.standard.publication.main, info),
      )
      break
  }
}

/**
 * Read-path resolution: caller pinned a set of `(uri, cid)` strongRefs in
 * the post at write time, and we honor those exact versions. Any pair
 * that doesn't structurally agree is rejected, so downstream callers can
 * trust the returned shape.
 *
 * Same observable contract as
 * `getSiteStandardRecordsFromHydrationMapsByDocumentUri` (the compose-path
 * sister) — both functions guarantee that a returned `(doc, pub)` pair
 * has matching site/uri, and reject orphan docs that claim a
 * non-hydrated publication. They differ only in how upstream availability
 * is asserted: this one trusts caller-supplied refs; the sister derives
 * everything from the dataplane response.
 *
 * Pairing rules:
 * - Both slots referenced: `doc.site` must equal `publication.ref.uri`,
 *   else both come back `undefined`.
 * - Doc with at-uri `site` referenced but no matching publication ref:
 *   reject the whole pairing (doc claims a publication that should have
 *   been pinned, but wasn't).
 * - Loose doc (web-URL `site`) referenced: publication stays `undefined`.
 * - Only a publication referenced: document stays `undefined`.
 *
 * Each returned slot carries the matching `ref` so callers can recover
 * the owner DID for blob-cdn URL building, etc.
 */
export const getSiteStandardRecordsFromHydrationMapsByRefs = (
  associatedRefs: readonly { uri: AtUriString; cid: string }[] | undefined,
  documents: SiteStandardDocuments | undefined,
  publications: SiteStandardPublications | undefined,
): {
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  publication: AssociatedSiteStandardRecord<SiteStandardPublication> | undefined
} => {
  if (!associatedRefs?.length) {
    return { document: undefined, publication: undefined }
  }

  // Resolve each ref against the hydration maps, taking the first hit on
  // each side.
  let document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  let publication:
    AssociatedSiteStandardRecord<SiteStandardPublication> | undefined
  for (const ref of associatedRefs) {
    const key = genericRecordKey(ref)
    if (!document) {
      const hit = documents?.get(key)
      if (hit) document = { ref, info: hit }
    }
    if (!publication) {
      const hit = publications?.get(key)
      if (hit) publication = { ref, info: hit }
    }
    if (document && publication) break
  }

  // Both refs resolved: enforce that the doc's `site` actually points at
  // the supplied publication. Mismatch means the post was misconstructed
  // (or tampered with), so reject the whole pairing.
  if (document && publication) {
    if (document.info.record.site !== publication.ref.uri) {
      hydrationLogger.warn(
        {
          documentUri: document.ref.uri,
          documentSite: document.info.record.site,
          publicationUri: publication.ref.uri,
        },
        'site.standard byRefs lookup failed: doc.site does not match hydrated publication.uri',
      )
      return { document: undefined, publication: undefined }
    }
  }

  // Doc with at-uri `site` but no publication: the post should have
  // pinned the publication too. Treat as misconstructed — same contract
  // as the compose-path lookup.
  if (document && !publication) {
    const site = document.info.record.site
    if (site && site.startsWith('at://')) {
      hydrationLogger.warn(
        { documentUri: document.ref.uri, documentSite: site },
        'site.standard byRefs lookup failed: document.site is AT URI but no matching publication was hydrated',
      )
      return { document: undefined, publication: undefined }
    }
  }

  return { document, publication }
}

/**
 * Compose-path resolution: no caller-supplied refs — the dataplane
 * returned the latest version of each record (including any
 * publications it auto-resolved from a document's `site` field). Take
 * the first hydrated document and pair it with the publication its
 * `site` field points at.
 *
 * Same observable contract as
 * `getSiteStandardRecordsFromHydrationMapsByRefs` (the read-path
 * sister) — both functions guarantee that a returned `(doc, pub)` pair
 * has matching site/uri, and reject orphan docs that claim a
 * non-hydrated publication. They differ only in how upstream
 * availability is asserted: this one walks whatever was returned by the
 * dataplane; the sister checks against caller-supplied refs.
 *
 * Pairing rules:
 * - Doc with at-uri `site`: must find a hydrated publication at that
 *   URI. If none was hydrated, the doc/publication chain is incomplete
 *   and the function returns `undefined` for both slots; the doc alone
 *   isn't useful without its source (can't verify the pub)
 * - Doc with web-URL `site` (loose): no publication.
 * - No doc hydrated: fall through to the first hydrated publication for
 *   the publication-only resolution flow.
 */
export const getSiteStandardRecordsFromHydrationMapsByDocumentUri = (
  documents: SiteStandardDocuments | undefined,
  publications: SiteStandardPublications | undefined,
): {
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  publication: AssociatedSiteStandardRecord<SiteStandardPublication> | undefined
} => {
  // First hydrated doc.
  let document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  for (const [key, info] of documents ?? []) {
    if (!info) continue
    document = { ref: parseGenericRecordKey(key), info }
    break
  }

  let publication:
    AssociatedSiteStandardRecord<SiteStandardPublication> | undefined
  if (document) {
    const site = document.info.record.site
    if (site && site.startsWith('at://')) {
      // Doc declared an at-uri publication; we need it.
      for (const [key, info] of publications ?? []) {
        if (!info) continue
        const ref = parseGenericRecordKey(key)
        if (ref.uri === site) {
          publication = { ref, info }
          break
        }
      }
      if (!publication) {
        hydrationLogger.warn(
          { documentUri: document.ref.uri, documentSite: site },
          'site.standard byDocumentUri lookup failed: document.site is AT URI but no matching publication was hydrated',
        )
        return { document: undefined, publication: undefined }
      }
    }
    // else: loose doc (web-URL site), no publication needed.
  } else {
    // Publication-only flow: no doc, take the first hydrated publication.
    for (const [key, info] of publications ?? []) {
      if (!info) continue
      publication = { ref: parseGenericRecordKey(key), info }
      break
    }
  }

  return { document, publication }
}
