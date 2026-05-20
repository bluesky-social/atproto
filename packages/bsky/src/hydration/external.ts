import { AtUriString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client/index.js'
import { site } from '../lexicons/index.js'
import {
  GetSiteStandardRecordsByRefResponse,
  GetSiteStandardRecordsByURIResponse,
} from '../proto/bsky_pb.js'
import { siteStandardRecordKey } from '../util/standard-site.js'
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
 * Resolves `associatedRefs` against the supplied hydration maps and returns
 * the document/publication pair the post (or compose request) pinned. The
 * maps are keyed by `${uri}@${cid}` so a single batch can carry multiple
 * versions of the same URI; the lookup is version-exact via that composite
 * key.
 *
 * Pairing rules:
 * - If `associatedRefs` carries both a doc and a publication, the doc's
 *   `site` field must equal the publication ref's URI. Otherwise the
 *   embed was misconstructed; both slots come back `undefined`.
 * - If only a doc is referenced, the publication slot stays `undefined`
 *   (loose doc or unpublished pairing).
 * - If only a publication is referenced, the document slot stays
 *   `undefined`.
 *
 * Each returned slot carries the matching `ref` so callers can recover
 * the owner DID for blob-cdn URL building, etc.
 */
export const getSiteStandardRecordsFromHydrationMaps = (
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

  return { document, publication }
}
