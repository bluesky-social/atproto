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
