import { Timestamp } from '@bufbuild/protobuf'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, test, vi } from 'vitest'
import { lexStringify, parseCid } from '@atproto/lex'
import { site } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import {
  GetAtmosphereBacklinkCountsResponse,
  GetAtmosphereBacklinksByActorResponse,
  GetAtmosphereBacklinksResponse,
  GetAtmosphereTimelineResponse,
  GetRecordsByRefResponse,
  GetRecordsByURIResponse,
  Record as RecordEntry,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import { siteStandardRecordKey } from '../util/standard-site.js'
import {
  ExternalHydrator,
  type SiteStandardDocument,
  type SiteStandardDocuments,
  type SiteStandardPublication,
  type SiteStandardPublications,
  genericRecordKey,
  getSiteStandardRecordsFromHydrationMapsByDocumentUri,
  getSiteStandardRecordsFromHydrationMapsByRefs,
} from './external.js'
import { HydrationMap, type ItemRef } from './util.js'

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

describe(ExternalHydrator, () => {
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(() => {}),
  )
  const hydrator = new ExternalHydrator(dataplane)
  const collection = site.standard.document.$type
  const sortedAt = new Date('2026-10-01T00:00:00Z')
  const indexedAt = new Date('2026-10-02T00:00:00Z')
  const record = {
    $type: collection,
    title: 'Document',
    extra: {
      link: parseCid(
        'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
      ),
      bytes: new Uint8Array([1, 2, 3]),
    },
  }
  const entry = new RecordEntry({
    cid: docCid,
    record: Buffer.from(lexStringify(record)),
    sortedAt: Timestamp.fromDate(sortedAt),
    indexedAt: Timestamp.fromDate(indexedAt),
  })

  it('short-circuits empty batches without calling the dataplane', async () => {
    using byRef = vi.spyOn(dataplane, 'getRecordsByRef')
    using byURI = vi.spyOn(dataplane, 'getRecordsByURI')
    using counts = vi.spyOn(dataplane, 'getAtmosphereBacklinkCounts')
    using byActor = vi.spyOn(dataplane, 'getAtmosphereBacklinksByActor')

    expect(await hydrator.getRecordsByRef([])).toEqual(new HydrationMap())
    expect(await hydrator.getRecordsByURI([])).toEqual(new HydrationMap())
    expect(await hydrator.getAtmosphereBacklinkCounts([])).toEqual(
      new HydrationMap(),
    )
    expect(
      await hydrator.getAtmosphereBacklinksByActor([], docDid, collection),
    ).toEqual({
      backlinks: new HydrationMap(),
      truncated: false,
    })
    expect(byRef).not.toHaveBeenCalled()
    expect(byURI).not.toHaveBeenCalled()
    expect(counts).not.toHaveBeenCalled()
    expect(byActor).not.toHaveBeenCalled()
  })

  it('hydrates mixed collections by URI without altering record bodies', async () => {
    const publication = site.standard.publication.$build({
      url: 'https://example.com',
      name: 'Publication',
    })
    using lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockResolvedValue(
      new GetRecordsByURIResponse({
        results: [
          {
            ref: { uri: docUri, cid: docCid },
            status: RecordLookupStatus.FOUND,
            record: entry,
          },
          {
            ref: { uri: pubUri, cid: pubCid },
            status: RecordLookupStatus.FOUND,
            record: {
              cid: pubCid,
              record: Buffer.from(lexStringify(publication)),
            },
          },
          { ref: { uri: otherPubUri }, status: RecordLookupStatus.NOT_FOUND },
        ],
      }),
    )

    const records = await hydrator.getRecordsByURI([
      docUri,
      pubUri,
      otherPubUri,
    ])
    expect(lookup).toHaveBeenCalledExactlyOnceWith({
      uris: [docUri, pubUri, otherPubUri],
    })
    expect(records.get(docUri)).toEqual({
      record,
      cid: docCid,
      sortedAt,
      indexedAt,
      takedownRef: undefined,
    })
    expect(records.get(pubUri)?.record).toEqual(publication)
    expect(records.get(otherPubUri)).toBeNull()
  })

  it('keeps exact versions distinct and forwards duplicate refs', async () => {
    const refs: Required<ItemRef>[] = [
      { uri: docUri, cid: docCid },
      { uri: docUri, cid: 'other-cid' },
      { uri: pubUri, cid: pubCid },
      { uri: docUri, cid: docCid },
    ]
    using lookup = vi.spyOn(dataplane, 'getRecordsByRef').mockResolvedValue(
      new GetRecordsByRefResponse({
        results: [
          { ref: refs[0], status: RecordLookupStatus.FOUND, record: entry },
          {
            ref: refs[1],
            status: RecordLookupStatus.FOUND,
            record: { ...entry, cid: 'other-cid' },
          },
          { ref: refs[2], status: RecordLookupStatus.NOT_FOUND },
          { ref: refs[3], status: RecordLookupStatus.FOUND, record: entry },
        ],
      }),
    )

    const records = await hydrator.getRecordsByRef(refs)
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ refs })
    expect(records.size).toBe(3)
    expect(records.get(genericRecordKey(docUri, docCid))?.cid).toBe(docCid)
    expect(records.get(genericRecordKey(docUri, 'other-cid'))?.cid).toBe(
      'other-cid',
    )
    expect(records.get(genericRecordKey(pubUri, pubCid))).toBeNull()
  })

  test.each([
    RecordLookupStatus.UNSPECIFIED,
    RecordLookupStatus.NOT_FOUND,
    RecordLookupStatus.INVALID_REF,
    RecordLookupStatus.UNSUPPORTED_COLLECTION,
  ])('does not hydrate unsuccessful lookup status %s', async (status) => {
    using lookup = vi
      .spyOn(dataplane, 'getRecordsByURI')
      .mockResolvedValue(
        new GetRecordsByURIResponse({ results: [{ status, record: entry }] }),
      )
    expect((await hydrator.getRecordsByURI([docUri])).get(docUri)).toBeNull()
    expect(
      (await hydrator.getRecordsByURI([docUri], true)).get(docUri),
    ).toBeNull()
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  test.each([
    {
      status: RecordLookupStatus.TAKEN_DOWN,
      takenDown: true,
      takedownRef: 'moderation-ref',
      expected: 'moderation-ref',
    },
    {
      status: RecordLookupStatus.FOUND,
      takenDown: true,
      takedownRef: '',
      expected: 'BSKY-TAKEDOWN-UNKNOWN',
    },
    {
      status: RecordLookupStatus.TAKEN_DOWN,
      takenDown: false,
      takedownRef: 'moderation-ref',
      expected: 'moderation-ref',
    },
  ])(
    'filters takedowns for $status/$takenDown unless explicitly included',
    async ({ status, takenDown, takedownRef, expected }) => {
      using lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockResolvedValue(
        new GetRecordsByURIResponse({
          results: [{ status, record: { ...entry, takenDown, takedownRef } }],
        }),
      )
      expect((await hydrator.getRecordsByURI([docUri])).get(docUri)).toBeNull()
      expect(
        (await hydrator.getRecordsByURI([docUri], true)).get(docUri),
      ).toEqual({
        record,
        cid: docCid,
        sortedAt,
        indexedAt,
        takedownRef: expected,
      })
      expect(lookup).toHaveBeenCalledTimes(2)
    },
  )

  test.each(['', '{', 'null', '[]', '{}', '{"$type":42}'])(
    'treats invalid record body %j as unavailable',
    async (body) => {
      using lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockResolvedValue(
        new GetRecordsByURIResponse({
          results: [
            {
              status: RecordLookupStatus.FOUND,
              record: { ...entry, record: Buffer.from(body) },
            },
          ],
        }),
      )
      expect((await hydrator.getRecordsByURI([docUri])).get(docUri)).toBeNull()
      expect(lookup).toHaveBeenCalledOnce()
    },
  )

  it('handles missing record entries, missing CIDs, and short responses', async () => {
    using lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockResolvedValue(
      new GetRecordsByURIResponse({
        results: [
          { status: RecordLookupStatus.FOUND },
          { status: RecordLookupStatus.FOUND, record: { ...entry, cid: '' } },
        ],
      }),
    )
    const records = await hydrator.getRecordsByURI([
      docUri,
      pubUri,
      otherPubUri,
    ])
    expect([...records.values()]).toEqual([null, null, null])
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('normalizes missing and Go zero-value record timestamps to the epoch', async () => {
    using lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockResolvedValue(
      new GetRecordsByURIResponse({
        results: [
          {
            status: RecordLookupStatus.FOUND,
            record: {
              ...entry,
              sortedAt: undefined,
              indexedAt: Timestamp.fromDate(new Date('0001-01-01T00:00:00Z')),
            },
          },
        ],
      }),
    )
    expect((await hydrator.getRecordsByURI([docUri])).get(docUri)).toEqual({
      record,
      cid: docCid,
      sortedAt: new Date(0),
      indexedAt: new Date(0),
      takedownRef: undefined,
    })
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('propagates dataplane failures instead of turning them into misses', async () => {
    const error = new Error('dataplane unavailable')
    using lookup = vi
      .spyOn(dataplane, 'getRecordsByURI')
      .mockRejectedValue(error)
    await expect(hydrator.getRecordsByURI([docUri])).rejects.toThrow(error)
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('hydrates timeline pages in order and preserves pagination', async () => {
    using timeline = vi
      .spyOn(dataplane, 'getAtmosphereTimeline')
      .mockResolvedValueOnce(
        new GetAtmosphereTimelineResponse({
          items: [
            { uri: docUri, sortedAt: Timestamp.fromDate(sortedAt) },
            { uri: pubUri },
          ],
          cursor: 'next-page',
        }),
      )
      .mockResolvedValueOnce(new GetAtmosphereTimelineResponse())

    expect(
      await hydrator.getAtmosphereTimeline(docDid, {
        limit: 2,
        cursor: 'previous-page',
      }),
    ).toEqual({
      items: [
        { uri: docUri, sortedAt },
        { uri: pubUri, sortedAt: new Date(0) },
      ],
      cursor: 'next-page',
    })
    expect(timeline).toHaveBeenNthCalledWith(1, {
      viewerDid: docDid,
      limit: 2,
      cursor: 'previous-page',
    })
    expect(await hydrator.getAtmosphereTimeline(docDid)).toEqual({
      items: [],
      cursor: undefined,
    })
    expect(timeline).toHaveBeenNthCalledWith(2, { viewerDid: docDid })
  })

  it('hydrates counts per target and collection as numbers', async () => {
    using counts = vi
      .spyOn(dataplane, 'getAtmosphereBacklinkCounts')
      .mockResolvedValue(
        new GetAtmosphereBacklinkCountsResponse({
          results: [
            {
              targetUri: docUri,
              counts: {
                [collection]: 12n,
                [site.standard.publication.$type]: 0n,
              },
            },
            { targetUri: pubUri },
          ],
        }),
      )
    const result = await hydrator.getAtmosphereBacklinkCounts([docUri, pubUri])
    expect(result.get(docUri)).toEqual({
      [collection]: 12,
      [site.standard.publication.$type]: 0,
    })
    expect(result.get(pubUri)).toEqual({})
    expect(counts).toHaveBeenNthCalledWith(1, {
      targetUris: [docUri, pubUri],
      collection: undefined,
    })

    await hydrator.getAtmosphereBacklinkCounts([docUri], collection)
    expect(counts).toHaveBeenNthCalledWith(2, {
      targetUris: [docUri],
      collection,
    })
  })

  it('hydrates backlink pages and normalizes the terminal cursor', async () => {
    using backlinks = vi
      .spyOn(dataplane, 'getAtmosphereBacklinks')
      .mockResolvedValueOnce(
        new GetAtmosphereBacklinksResponse({
          backlinks: [{ uri: pubUri, sortedAt: Timestamp.fromDate(sortedAt) }],
          cursor: 'next-page',
        }),
      )
      .mockResolvedValueOnce(new GetAtmosphereBacklinksResponse())

    expect(
      await hydrator.getAtmosphereBacklinks(docUri, collection, {
        limit: 1,
        cursor: 'previous-page',
      }),
    ).toEqual({
      backlinks: [{ uri: pubUri, sortedAt }],
      cursor: 'next-page',
    })
    expect(backlinks).toHaveBeenNthCalledWith(1, {
      targetUri: docUri,
      collection,
      limit: 1,
      cursor: 'previous-page',
    })
    expect(await hydrator.getAtmosphereBacklinks(docUri, collection)).toEqual({
      backlinks: [],
      cursor: undefined,
    })
    expect(backlinks).toHaveBeenNthCalledWith(2, {
      targetUri: docUri,
      collection,
    })
  })

  test.each([false, true])(
    'retains all actor backlinks and truncated=%s',
    async (truncated) => {
      using byActor = vi
        .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
        .mockResolvedValue(
          new GetAtmosphereBacklinksByActorResponse({
            results: [
              { targetUri: docUri, uris: [pubUri, otherPubUri] },
              { targetUri: pubUri, uris: [] },
            ],
            truncated,
          }),
        )
      const result = await hydrator.getAtmosphereBacklinksByActor(
        [docUri, pubUri],
        pubDid,
        collection,
      )
      expect(result.backlinks.get(docUri)).toEqual([pubUri, otherPubUri])
      expect(result.backlinks.get(pubUri)).toEqual([])
      expect(result.truncated).toBe(truncated)
      expect(byActor).toHaveBeenCalledExactlyOnceWith({
        targetUris: [docUri, pubUri],
        actorDid: pubDid,
        collection,
      })
    },
  )
})
