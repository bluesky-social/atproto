import { describe, expect, it } from 'vitest'
import { siteStandardRecordKey } from '../util/standard-site.js'
import {
  type SiteStandardDocument,
  type SiteStandardDocuments,
  type SiteStandardPublication,
  type SiteStandardPublications,
  getSiteStandardRecordsFromHydrationMapsByDocumentUri,
  getSiteStandardRecordsFromHydrationMapsByRefs,
} from './external.js'
import { HydrationMap } from './util.js'

const docDid = 'did:plc:doc'
const pubDid = 'did:plc:pub'
const otherPubDid = 'did:plc:other'

const docUri = `at://${docDid}/site.standard.document/abc`
const pubUri = `at://${pubDid}/site.standard.publication/self`
const otherPubUri = `at://${otherPubDid}/site.standard.publication/self`

const docCid = 'bafydoc'
const pubCid = 'bafypub'
const otherPubCid = 'bafyother'

const makeDocInfo = (
  record: { site: string; path?: string; title?: string },
  cid = docCid,
): SiteStandardDocument =>
  ({
    record,
    cid,
    sortedAt: new Date(0),
    indexedAt: new Date(0),
    takedownRef: undefined,
  }) as unknown as SiteStandardDocument

const makePubInfo = (
  record: { url: string; name?: string },
  cid = pubCid,
): SiteStandardPublication =>
  ({
    record,
    cid,
    sortedAt: new Date(0),
    indexedAt: new Date(0),
    takedownRef: undefined,
  }) as unknown as SiteStandardPublication

const makeDocuments = (
  entries: [uri: string, cid: string, info: SiteStandardDocument | null][] = [],
): SiteStandardDocuments => {
  const map: SiteStandardDocuments = new HydrationMap()
  for (const [uri, cid, info] of entries) {
    map.set(siteStandardRecordKey(uri, cid), info)
  }
  return map
}

const makePublications = (
  entries: [
    uri: string,
    cid: string,
    info: SiteStandardPublication | null,
  ][] = [],
): SiteStandardPublications => {
  const map: SiteStandardPublications = new HydrationMap()
  for (const [uri, cid, info] of entries) {
    map.set(siteStandardRecordKey(uri, cid), info)
  }
  return map
}

describe(getSiteStandardRecordsFromHydrationMapsByRefs, () => {
  it('returns both slots when refs resolve and doc.site matches the publication', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByRefs(
        [
          { uri: docUri, cid: docCid },
          { uri: pubUri, cid: pubCid },
        ],
        docs,
        pubs,
      )
    expect(document?.ref).toEqual({ uri: docUri, cid: docCid })
    expect(publication?.ref).toEqual({ uri: pubUri, cid: pubCid })
  })

  it('rejects the whole pair when doc.site does not match the resolved publication', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: otherPubUri })],
    ])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    const result = getSiteStandardRecordsFromHydrationMapsByRefs(
      [
        { uri: docUri, cid: docCid },
        { uri: pubUri, cid: pubCid },
      ],
      docs,
      pubs,
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })

  it('rejects the whole pair when doc declares an at-uri site but no publication ref was supplied', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications()
    const result = getSiteStandardRecordsFromHydrationMapsByRefs(
      [{ uri: docUri, cid: docCid }],
      docs,
      pubs,
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })

  it('returns only the doc when site is a web URL (loose doc)', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: 'https://example.com' })],
    ])
    const pubs = makePublications()
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByRefs(
        [{ uri: docUri, cid: docCid }],
        docs,
        pubs,
      )
    expect(document?.ref).toEqual({ uri: docUri, cid: docCid })
    expect(publication).toBeUndefined()
  })

  it('returns only the publication when no doc ref is supplied', () => {
    const docs = makeDocuments()
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByRefs(
        [{ uri: pubUri, cid: pubCid }],
        docs,
        pubs,
      )
    expect(document).toBeUndefined()
    expect(publication?.ref).toEqual({ uri: pubUri, cid: pubCid })
  })

  it('returns nothing when the version-exact lookup misses', () => {
    // Doc indexed at one cid; ref points at a different cid.
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications()
    const result = getSiteStandardRecordsFromHydrationMapsByRefs(
      [{ uri: docUri, cid: 'bafy-different' }],
      docs,
      pubs,
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })

  it('returns nothing when associatedRefs is empty or undefined', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    expect(
      getSiteStandardRecordsFromHydrationMapsByRefs([], docs, pubs),
    ).toEqual({ document: undefined, publication: undefined })
    expect(
      getSiteStandardRecordsFromHydrationMapsByRefs(undefined, docs, pubs),
    ).toEqual({ document: undefined, publication: undefined })
  })

  it('skips null entries (taken-down records) and reports them as misses', () => {
    const docs = makeDocuments([[docUri, docCid, null]])
    const pubs = makePublications()
    const result = getSiteStandardRecordsFromHydrationMapsByRefs(
      [{ uri: docUri, cid: docCid }],
      docs,
      pubs,
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })
})

describe(getSiteStandardRecordsFromHydrationMapsByDocumentUri, () => {
  it('pairs the first hydrated doc with the publication its site points to', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByDocumentUri(docs, pubs)
    expect(document?.ref).toEqual({ uri: docUri, cid: docCid })
    expect(publication?.ref).toEqual({ uri: pubUri, cid: pubCid })
  })

  it('rejects the pair when the declared publication was not hydrated', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications()
    const result = getSiteStandardRecordsFromHydrationMapsByDocumentUri(
      docs,
      pubs,
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })

  it('returns only the doc when site is a web URL (loose doc)', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: 'https://example.com' })],
    ])
    const pubs = makePublications()
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByDocumentUri(docs, pubs)
    expect(document?.ref).toEqual({ uri: docUri, cid: docCid })
    expect(publication).toBeUndefined()
  })

  it('falls through to first hydrated publication when no doc was hydrated', () => {
    const docs = makeDocuments()
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByDocumentUri(docs, pubs)
    expect(document).toBeUndefined()
    expect(publication?.ref).toEqual({ uri: pubUri, cid: pubCid })
  })

  it('ignores extraneous publications not referenced by the doc', () => {
    const docs = makeDocuments([
      [docUri, docCid, makeDocInfo({ site: pubUri })],
    ])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
      [
        otherPubUri,
        otherPubCid,
        makePubInfo({ url: 'https://other.com' }, otherPubCid),
      ],
    ])
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByDocumentUri(docs, pubs)
    expect(document?.ref.uri).toBe(docUri)
    expect(publication?.ref.uri).toBe(pubUri)
  })

  it('returns nothing when both maps are empty', () => {
    const result = getSiteStandardRecordsFromHydrationMapsByDocumentUri(
      makeDocuments(),
      makePublications(),
    )
    expect(result).toEqual({ document: undefined, publication: undefined })
  })

  it('skips null entries (taken-down records)', () => {
    const docs = makeDocuments([[docUri, docCid, null]])
    const pubs = makePublications([
      [pubUri, pubCid, makePubInfo({ url: 'https://example.com' })],
    ])
    // No live doc -> falls through to publication-only.
    const { document, publication } =
      getSiteStandardRecordsFromHydrationMapsByDocumentUri(docs, pubs)
    expect(document).toBeUndefined()
    expect(publication?.ref.uri).toBe(pubUri)
  })
})
