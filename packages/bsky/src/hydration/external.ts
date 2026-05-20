import { AtUriString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client/index.js'
import { site } from '../lexicons/index.js'
import {
  GetSiteStandardRecordsByRefResponse,
  GetSiteStandardRecordsByURIResponse,
} from '../proto/bsky_pb.js'
import {
  parseSiteStandardRecordKey,
  siteStandardRecordKey,
} from '../util/standard-site.js'
import {
  SiteStandardDocumentRecord,
  SiteStandardPublicationRecord,
} from '../views/types.js'
import { HydrationMap, ItemRef, RecordInfo, parseRecord } from './util.js'

export type SiteStandardDocument = RecordInfo<SiteStandardDocumentRecord>
export type SiteStandardPublication = RecordInfo<SiteStandardPublicationRecord>

/**
 * Keyed by `${uri}@${cid}` — see `siteStandardRecordKey`. A single hydration
 * batch can pull more than one version of the same URI (different posts
 * pinning different cids), so the composite key is needed for O(1)
 * version-exact lookups.
 */
export type SiteStandardDocuments = HydrationMap<string, SiteStandardDocument>
/**
 * Keyed by `${uri}@${cid}`. See `SiteStandardDocuments` for the rationale.
 */
export type SiteStandardPublications = HydrationMap<
  string,
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
  constructor(public dataplane: DataPlaneClient) {}

  async getSiteStandardRecordsByRef(
    refs: ItemRef[],
    includeTakedowns = false,
  ): Promise<SiteStandardRecords> {
    if (!refs.length) return emptySiteStandardRecords()

    const res = await this.dataplane.getSiteStandardRecordsByRef({
      refs: refs.map(({ uri, cid }) => ({ uri, cid: cid ?? '' })),
    })
    return buildSiteStandardRecordsHydrationMaps(res, includeTakedowns)
  }

  async getSiteStandardRecordsByURI(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<SiteStandardRecords> {
    if (!uris.length) return emptySiteStandardRecords()

    const res = await this.dataplane.getSiteStandardRecordsByURI({ uris })
    return buildSiteStandardRecordsHydrationMaps(res, includeTakedowns)
  }
}

const emptySiteStandardRecords = (): SiteStandardRecords => ({
  documents: new HydrationMap(),
  publications: new HydrationMap(),
})

const buildSiteStandardRecordsHydrationMaps = (
  res:
    | GetSiteStandardRecordsByURIResponse
    | GetSiteStandardRecordsByRefResponse,
  includeTakedowns: boolean,
): SiteStandardRecords => {
  const documents: SiteStandardDocuments = new HydrationMap()
  for (const { ref, record } of res.documents) {
    if (!ref?.uri || !ref.cid || !record) continue
    documents.set(
      siteStandardRecordKey(ref.uri, ref.cid),
      parseRecord(site.standard.document.main, record, includeTakedowns) ??
        null,
    )
  }
  const publications: SiteStandardPublications = new HydrationMap()
  for (const { ref, record } of res.publications) {
    if (!ref?.uri || !ref.cid || !record) continue
    publications.set(
      siteStandardRecordKey(ref.uri, ref.cid),
      parseRecord(site.standard.publication.main, record, includeTakedowns) ??
        null,
    )
  }
  return { documents, publications }
}

/**
 * Strict (read-path) resolution: trust `associatedRefs` as the source of
 * truth and reject any pair that doesn't agree. Posts pin specific
 * `(uri, cid)` strongRefs at write time; this function honors those exact
 * versions and refuses to render enrichment from records that disagree.
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
 * For the compose-path counterpart that doesn't have caller-supplied
 * refs and instead resolves doc.site against whatever publications were
 * auto-resolved, see `getSiteStandardRecordsFromHydrationMapsByDocumentUri`.
 *
 * Each returned slot carries the matching `ref` so callers can recover
 * the owner DID for blob-cdn URL building, etc.
 */
export const getSiteStandardRecordsFromHydrationMapsByRefs = (
  associatedRefs:
    | readonly { uri: AtUriString; cid: string }[]
    | undefined,
  documents: SiteStandardDocuments | undefined,
  publications: SiteStandardPublications | undefined,
): {
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  publication:
    | AssociatedSiteStandardRecord<SiteStandardPublication>
    | undefined
} => {
  if (!associatedRefs?.length) {
    return { document: undefined, publication: undefined }
  }

  // Resolve each ref against the hydration maps, taking the first hit on
  // each side.
  let document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  let publication:
    | AssociatedSiteStandardRecord<SiteStandardPublication>
    | undefined
  for (const ref of associatedRefs) {
    const key = siteStandardRecordKey(ref.uri, ref.cid)
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
      return { document: undefined, publication: undefined }
    }
  }

  // Doc with at-uri `site` but no publication: the post should have
  // pinned the publication too. Treat as misconstructed — same contract
  // as the compose-path lookup.
  if (document && !publication) {
    const site = document.info.record.site
    if (site && site.startsWith('at://')) {
      return { document: undefined, publication: undefined }
    }
  }

  return { document, publication }
}

/**
 * Compose-path resolution: there are no caller-supplied refs to
 * arbitrate against — the dataplane returns the latest version of each
 * record, including auto-resolved publications. Take the first hydrated
 * document and pair it with the publication its `site` field points at.
 *
 * Pairing rules:
 * - Doc with at-uri `site`: must find a hydrated publication at that
 *   URI. If none was hydrated, the doc/publication chain is incomplete
 *   and the function returns `undefined` for both slots; the doc alone
 *   isn't useful without its source.
 * - Doc with web-URL `site` (loose): no publication.
 * - No doc hydrated: fall through to the first hydrated publication for
 *   the publication-only resolution flow.
 *
 * Sister to `getSiteStandardRecordsFromHydrationMapsByRefs`; see that
 * doc for the shape of returned slots.
 */
export const getSiteStandardRecordsFromHydrationMapsByDocumentUri = (
  documents: SiteStandardDocuments | undefined,
  publications: SiteStandardPublications | undefined,
): {
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  publication:
    | AssociatedSiteStandardRecord<SiteStandardPublication>
    | undefined
} => {
  // First hydrated doc.
  let document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined
  for (const [key, info] of documents ?? []) {
    if (!info) continue
    document = { ref: parseSiteStandardRecordKey(key), info }
    break
  }

  let publication:
    | AssociatedSiteStandardRecord<SiteStandardPublication>
    | undefined
  if (document) {
    const site = document.info.record.site
    if (site && site.startsWith('at://')) {
      // Doc declared an at-uri publication; we need it.
      for (const [key, info] of publications ?? []) {
        if (!info) continue
        const ref = parseSiteStandardRecordKey(key)
        if (ref.uri === site) {
          publication = { ref, info }
          break
        }
      }
      if (!publication) {
        return { document: undefined, publication: undefined }
      }
    }
    // else: loose doc (web-URL site), no publication needed.
  } else {
    // Publication-only flow: no doc, take the first hydrated publication.
    for (const [key, info] of publications ?? []) {
      if (!info) continue
      publication = { ref: parseSiteStandardRecordKey(key), info }
      break
    }
  }

  return { document, publication }
}
