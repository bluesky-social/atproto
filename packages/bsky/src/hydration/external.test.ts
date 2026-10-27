import { type PartialMessage, Timestamp } from '@bufbuild/protobuf'
import {
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { describe, expect, expectTypeOf, it, test, vi } from 'vitest'
import { type AtUriString, lexStringify, parseCid } from '@atproto/lex'
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
  type RecordLookupResult,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import {
  type ExactRecordKey,
  ExternalHydrator,
  type ExternalRecord,
  type ExternalRecordsByRef,
  type SiteStandardDocument,
  type SiteStandardDocuments,
  type SiteStandardPublication,
  type SiteStandardPublications,
  genericRecordKey,
  getSiteStandardRecordsFromHydrationMapsByRefs,
  getSiteStandardRecordsFromRefs,
  parseGenericRecordKey,
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
  entries: [
    uri: AtUriString,
    cid: string,
    info: SiteStandardDocument | null,
  ][] = [],
): SiteStandardDocuments => {
  const map: SiteStandardDocuments = new HydrationMap()
  for (const [uri, cid, info] of entries) {
    map.set(genericRecordKey({ uri, cid }), info)
  }
  return map
}

const makePublications = (
  entries: [
    uri: AtUriString,
    cid: string,
    info: SiteStandardPublication | null,
  ][] = [],
): SiteStandardPublications => {
  const map: SiteStandardPublications = new HydrationMap()
  for (const [uri, cid, info] of entries) {
    map.set(genericRecordKey({ uri, cid }), info)
  }
  return map
}

describe(genericRecordKey, () => {
  it('keys latest lookups by URI and exact lookups by uri@cid', () => {
    const latest = genericRecordKey({ uri: docUri })
    const exact = genericRecordKey({ uri: docUri, cid: docCid })
    expect(latest).toBe(docUri)
    expect(exact).toBe(`${docUri}@${docCid}`)
    expectTypeOf(latest).toEqualTypeOf<string>()
    expectTypeOf(exact).toEqualTypeOf<ExactRecordKey>()
  })

  it('rejects an empty CID rather than treating it as a latest lookup', () => {
    expect(() => genericRecordKey({ uri: docUri, cid: '' })).toThrow()
  })

  it('only admits exact keys into exact-ref maps', () => {
    const map: ExternalRecordsByRef = new HydrationMap()
    const ref: ItemRef = { uri: docUri }
    // @ts-expect-error a latest lookup key is not an exact key
    map.set(genericRecordKey(ref), null)
    // @ts-expect-error a bare string is not an exact key
    map.set(`${docUri}@${docCid}`, null)
    map.set(genericRecordKey({ uri: docUri, cid: docCid }), null)
  })
})

describe(parseGenericRecordKey, () => {
  test.each([
    docUri,
    `at://${docDid}/${site.standard.document.$type}/a@b`,
  ] as const)('round-trips %s', (uri) => {
    expect(
      parseGenericRecordKey(genericRecordKey({ uri, cid: docCid })),
    ).toEqual({ uri, cid: docCid })
  })

  it('does not accept latest lookup keys', () => {
    // @ts-expect-error a latest lookup key is not an exact key
    const parse = () => parseGenericRecordKey(genericRecordKey({ uri: docUri }))
    expect(parse).toThrow('Malformed exact record key')
  })

  test.each([
    ['a missing separator', docUri],
    ['an empty URI', `@${docCid}`],
    ['an empty CID', `${docUri}@`],
  ])('rejects %s', (_, key) => {
    // Deliberately malformed, to exercise the runtime safeguard.
    expect(() => parseGenericRecordKey(key as ExactRecordKey)).toThrow(
      'Malformed exact record key',
    )
  })
})

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

describe(getSiteStandardRecordsFromRefs, () => {
  const doc = site.standard.document.$build({
    site: pubUri as AtUriString,
    path: '/post',
    title: 'Document',
    publishedAt: '2026-10-01T00:00:00.000Z',
  })
  const looseDoc = site.standard.document.$build({
    site: 'https://example.com',
    path: '/post',
    title: 'Loose',
    publishedAt: '2026-10-01T00:00:00.000Z',
  })
  const pub = site.standard.publication.$build({
    url: 'https://example.com',
    name: 'Publication',
  })
  const info = (record: object, cid: string): ExternalRecord => ({
    record: record as ExternalRecord['record'],
    cid,
    sortedAt: new Date(0),
    indexedAt: new Date(0),
    takedownRef: undefined,
  })
  const ref = (uri: string, cid: string) => ({ uri: uri as AtUriString, cid })
  const otherUri = 'at://did:plc:a/app.example.thing/1'
  const records = (
    ...entries: [uri: string, cid: string, value: ExternalRecord | null][]
  ): ExternalRecordsByRef => {
    const out: ExternalRecordsByRef = new HydrationMap()
    for (const [uri, cid, value] of entries) {
      out.set(genericRecordKey(ref(uri, cid)), value)
    }
    return out
  }

  it('selects a pinned pair, ignoring other versions and collections', () => {
    const out = getSiteStandardRecordsFromRefs(
      [ref(docUri, 'v1'), ref(otherUri, 'v1'), ref(pubUri, 'v1')],
      records(
        [docUri, 'v1', info(doc, 'v1')],
        [docUri, 'v2', info({ ...doc, title: 'Newer' }, 'v2')],
        [pubUri, 'v1', info(pub, 'v1')],
        // Latest dependency of another pin: never satisfies a pin.
        [pubUri, 'v2', info({ ...pub, name: 'Newer' }, 'v2')],
        [otherUri, 'v1', info({ $type: 'app.example.thing' }, 'v1')],
      ),
    )
    expect(out.document?.ref).toEqual(ref(docUri, 'v1'))
    expect(out.document?.info.record).toMatchObject({ title: 'Document' })
    expect(out.publication?.ref).toEqual(ref(pubUri, 'v1'))
    expect(out.publication?.info.record).toMatchObject({ name: 'Publication' })
  })

  it('does not fall back to a different version or the latest dependency', () => {
    expect(
      getSiteStandardRecordsFromRefs(
        [ref(pubUri, 'v1')],
        records([pubUri, 'v2', info(pub, 'v2')]),
      ),
    ).toEqual({ document: undefined, publication: undefined })
  })

  it('treats missing, nulled and invalid records as misses; first valid wins', () => {
    expect(
      getSiteStandardRecordsFromRefs(
        [ref(docUri, 'v1'), ref(pubUri, 'v1')],
        records(
          [docUri, 'v1', null],
          [pubUri, 'v1', info({ ...pub, name: 42 }, 'v1')],
        ),
      ),
    ).toEqual({ document: undefined, publication: undefined })
    expect(
      getSiteStandardRecordsFromRefs([ref(docUri, 'v1')], undefined),
    ).toEqual({ document: undefined, publication: undefined })

    const out = getSiteStandardRecordsFromRefs(
      [ref(pubUri, 'bad'), ref(pubUri, 'v1'), ref(pubUri, 'v2')],
      records(
        [pubUri, 'bad', info({ nope: true }, 'bad')],
        [pubUri, 'v1', info(pub, 'v1')],
        [pubUri, 'v2', info({ ...pub, name: 'Second' }, 'v2')],
      ),
    )
    expect(out.publication?.ref).toEqual(ref(pubUri, 'v1'))
  })

  it('rejects a record whose body is a different collection', () => {
    expect(
      getSiteStandardRecordsFromRefs(
        [ref(docUri, 'v1')],
        records([docUri, 'v1', info(pub, 'v1')]),
      ),
    ).toEqual({ document: undefined, publication: undefined })
  })

  it('rejects the pair when doc.site does not match the pinned publication', () => {
    expect(
      getSiteStandardRecordsFromRefs(
        [ref(docUri, 'v1'), ref(otherPubUri, 'v1')],
        records(
          [docUri, 'v1', info(doc, 'v1')],
          [otherPubUri, 'v1', info(pub, 'v1')],
        ),
      ),
    ).toEqual({ document: undefined, publication: undefined })
  })

  it('rejects an AT-site document with no pinned publication', () => {
    expect(
      getSiteStandardRecordsFromRefs(
        [ref(docUri, 'v1')],
        records(
          [docUri, 'v1', info(doc, 'v1')],
          [pubUri, 'v1', info(pub, 'v1')],
        ),
      ),
    ).toEqual({ document: undefined, publication: undefined })
  })

  it('allows a loose URL document or a publication alone', () => {
    const loose = getSiteStandardRecordsFromRefs(
      [ref(docUri, 'v1')],
      records([docUri, 'v1', info(looseDoc, 'v1')]),
    )
    expect(loose.document?.ref).toEqual(ref(docUri, 'v1'))
    expect(loose.publication).toBeUndefined()

    const pubOnly = getSiteStandardRecordsFromRefs(
      [ref(pubUri, 'v1')],
      records([pubUri, 'v1', info(pub, 'v1')]),
    )
    expect(pubOnly.document).toBeUndefined()
    expect(pubOnly.publication?.ref).toEqual(ref(pubUri, 'v1'))
  })

  it('returns nothing for empty or undefined refs', () => {
    const state = records([pubUri, 'v1', info(pub, 'v1')])
    expect(getSiteStandardRecordsFromRefs([], state)).toEqual({
      document: undefined,
      publication: undefined,
    })
    expect(getSiteStandardRecordsFromRefs(undefined, state)).toEqual({
      document: undefined,
      publication: undefined,
    })
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
    expect(
      records.get(genericRecordKey({ uri: docUri, cid: docCid }))?.cid,
    ).toBe(docCid)
    expect(
      records.get(genericRecordKey({ uri: docUri, cid: 'other-cid' }))?.cid,
    ).toBe('other-cid')
    expect(
      records.get(genericRecordKey({ uri: pubUri, cid: pubCid })),
    ).toBeNull()
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

  describe('bounded backlink count requests', () => {
    const limit = 100
    const uriOf = (i: number): AtUriString =>
      `at://${docDid}/${collection}/r${i}`
    const uriList = (count: number) =>
      Array.from({ length: count }, (_, i) => uriOf(i))
    // Every target gets a distinct count, except one zero and one empty entry.
    const countOf = (uri: string) => Number(uri.split('/r').pop()) + 1
    const respond = (uris: string[]) =>
      new GetAtmosphereBacklinkCountsResponse({
        results: uris.map((targetUri) => {
          const n = countOf(targetUri)
          if (n === 2) return { targetUri }
          return {
            targetUri,
            counts: { [collection]: n === 3 ? 0n : BigInt(n) },
          }
        }),
      })
    // Enforces the dataplane's 1-100 limit and records overlapping requests.
    const mockCounts = () => {
      const state = { inFlight: 0, maxInFlight: 0 }
      const spy = vi
        .spyOn(dataplane, 'getAtmosphereBacklinkCounts')
        .mockImplementation(async ({ targetUris = [] }) => {
          state.maxInFlight = Math.max(state.maxInFlight, ++state.inFlight)
          try {
            await new Promise((resolve) => setImmediate(resolve))
            if (targetUris.length < 1 || targetUris.length > limit) {
              throw new ConnectError(
                `between 1 and ${limit} target URIs are required`,
                Code.InvalidArgument,
              )
            }
            return respond(targetUris)
          } finally {
            state.inFlight--
          }
        })
      return { spy, state }
    }

    test.each([
      { count: 0, requests: [] },
      { count: 100, requests: [100] },
      { count: 101, requests: [100, 1] },
      { count: 205, requests: [100, 100, 5] },
    ])('fetches counts for $count targets', async ({ count, requests }) => {
      const input = uriList(count)
      const { spy, state } = mockCounts()
      using _ = spy
      const result = await hydrator.getAtmosphereBacklinkCounts(
        input,
        collection,
      )

      const calls = spy.mock.calls.map(([req]) => req)
      expect(calls.map((req) => req.targetUris?.length)).toEqual(requests)
      expect(calls.flatMap((req) => req.targetUris ?? [])).toEqual(input)
      for (const req of calls) expect(req.collection).toBe(collection)
      expect(state.maxInFlight).toBeLessThanOrEqual(1)

      expect([...result.keys()]).toEqual(input)
      for (const uri of input) {
        const n = countOf(uri)
        expect(result.get(uri)).toEqual(
          n === 2 ? {} : { [collection]: n === 3 ? 0 : n },
        )
      }
    })

    it('forwards an omitted collection on every chunk', async () => {
      const { spy } = mockCounts()
      using _ = spy
      await hydrator.getAtmosphereBacklinkCounts(uriList(101))
      expect(spy.mock.calls.map(([req]) => req.collection)).toEqual([
        undefined,
        undefined,
      ])
    })

    it('rejects the whole call without later requests when a chunk fails', async () => {
      const error = new Error('dataplane unavailable')
      const { spy } = mockCounts()
      using _ = spy
      spy
        .mockImplementationOnce(spy.getMockImplementation()!)
        .mockRejectedValueOnce(error)
      await expect(
        hydrator.getAtmosphereBacklinkCounts(uriList(205), collection),
      ).rejects.toThrow(error)
      expect(spy).toHaveBeenCalledTimes(2)
    })
  })

  describe('bounded generic record requests', () => {
    // The dataplane's request limit, enforced by every stub below.
    const limit = 100
    const uriOf = (i: number): AtUriString =>
      `at://${docDid}/${collection}/r${i}`
    const cidOf = (uri: string) => `cid-${uri.split('/').pop()}`
    const uriList = (count: number) =>
      Array.from({ length: count }, (_, i) => uriOf(i))
    const refList = (count: number): Required<ItemRef>[] =>
      uriList(count).map((uri) => ({ uri, cid: cidOf(uri) }))
    // A record whose body names the requested URI, so mispaired results show.
    const found = (
      uri: string,
      cid: string,
      takenDown = false,
    ): PartialMessage<RecordLookupResult> => ({
      ref: { uri, cid },
      status: takenDown
        ? RecordLookupStatus.TAKEN_DOWN
        : RecordLookupStatus.FOUND,
      record: {
        cid,
        record: Buffer.from(lexStringify({ $type: collection, title: uri })),
        takenDown,
        takedownRef: takenDown ? 'moderation-ref' : '',
      },
    })
    const expectFound = (
      info: ExternalRecord | null | undefined,
      uri: string,
      cid = cidOf(uri),
    ) => expect(info).toMatchObject({ cid, record: { title: uri } })

    type Respond = (
      uri: string,
      cid: string,
      request: number,
    ) => PartialMessage<RecordLookupResult>
    const mockByURI = (respond: Respond = (uri, cid) => found(uri, cid)) => {
      let requests = 0
      return vi
        .spyOn(dataplane, 'getRecordsByURI')
        .mockImplementation(async ({ uris = [] }) => {
          const request = ++requests
          if (uris.length > limit) {
            throw new ConnectError(
              `at most ${limit} URIs are allowed`,
              Code.InvalidArgument,
            )
          }
          return new GetRecordsByURIResponse({
            results: uris.map((uri) => respond(uri, cidOf(uri), request)),
          })
        })
    }
    const mockByRef = (respond: Respond = (uri, cid) => found(uri, cid)) => {
      let requests = 0
      return vi
        .spyOn(dataplane, 'getRecordsByRef')
        .mockImplementation(async ({ refs = [] }) => {
          const request = ++requests
          if (refs.length > limit) {
            throw new ConnectError(
              `at most ${limit} refs are allowed`,
              Code.InvalidArgument,
            )
          }
          return new GetRecordsByRefResponse({
            results: refs.map(({ uri = '', cid = '' }) =>
              respond(uri, cid, request),
            ),
          })
        })
    }

    const sizes = [
      { count: 0, requests: [] },
      { count: 100, requests: [100] },
      { count: 101, requests: [100, 1] },
      { count: 127, requests: [100, 27] },
      { count: 201, requests: [100, 100, 1] },
    ]

    it('bounds requests at the dataplane limit', () => {
      expect(ExternalHydrator.MAX_RECORDS_PER_REQUEST).toBe(limit)
    })

    test.each(sizes)('fetches $count URIs', async ({ count, requests }) => {
      const input = uriList(count)
      using lookup = mockByURI()
      const records = await hydrator.getRecordsByURI(input)

      const calls = lookup.mock.calls.map(([req]) => req.uris ?? [])
      expect(calls.map((chunk) => chunk.length)).toEqual(requests)
      expect(calls.flat()).toEqual(input)
      expect([...records.keys()]).toEqual(input)
      for (const uri of input) expectFound(records.get(uri), uri)
    })

    test.each(sizes)(
      'fetches $count exact refs',
      async ({ count, requests }) => {
        const input = refList(count)
        using lookup = mockByRef()
        const records = await hydrator.getRecordsByRef(input)

        const calls = lookup.mock.calls.map(([req]) => req.refs ?? [])
        expect(calls.map((chunk) => chunk.length)).toEqual(requests)
        expect(calls.flat()).toEqual(input)
        expect([...records.keys()]).toEqual(
          input.map((ref) => genericRecordKey(ref)),
        )
        for (const ref of input) {
          expectFound(records.get(genericRecordKey(ref)), ref.uri, ref.cid)
        }
      },
    )

    it('pairs results with their own request when a response is short', async () => {
      const input = uriList(127)
      using lookup = mockByURI()
      const impl = lookup.getMockImplementation()!
      // The first response omits its last result.
      lookup.mockImplementationOnce(async (req, options) => {
        const { results } = await impl(req, options)
        return new GetRecordsByURIResponse({ results: results.slice(0, -1) })
      })
      const records = await hydrator.getRecordsByURI(input)

      expect(lookup).toHaveBeenCalledTimes(2)
      expect(records.size).toBe(127)
      for (const uri of input.slice(0, 99)) expectFound(records.get(uri), uri)
      expect(records.get(input[99])).toBeNull()
      for (const uri of input.slice(100)) expectFound(records.get(uri), uri)
    })

    it('keeps unavailable and takedown semantics across request boundaries', async () => {
      const input = uriList(101)
      using lookup = mockByURI((uri, cid) =>
        uri === input[99]
          ? { ref: { uri }, status: RecordLookupStatus.NOT_FOUND }
          : found(uri, cid, uri === input[100]),
      )
      const hidden = await hydrator.getRecordsByURI(input)
      expectFound(hidden.get(input[98]), input[98])
      expect(hidden.get(input[99])).toBeNull()
      expect(hidden.get(input[100])).toBeNull()

      const included = await hydrator.getRecordsByURI(input, true)
      expect(included.get(input[99])).toBeNull()
      expectFound(included.get(input[100]), input[100])
      expect(included.get(input[100])?.takedownRef).toBe('moderation-ref')
      expect(lookup).toHaveBeenCalledTimes(4)
    })

    it('keeps exact versions distinct and forwards duplicates across request boundaries', async () => {
      const v1: Required<ItemRef> = { uri: docUri, cid: 'v1' }
      const v2: Required<ItemRef> = { uri: docUri, cid: 'v2' }
      const input = refList(101)
      input[0] = v1
      input[99] = v2
      input[100] = v1
      // The duplicate's later request answers differently: as within one
      // request, the later result wins.
      using lookup = mockByRef((uri, cid, request) =>
        uri === docUri && request === 2
          ? { ref: { uri, cid }, status: RecordLookupStatus.NOT_FOUND }
          : found(uri, cid),
      )
      const records = await hydrator.getRecordsByRef(input)

      expect(lookup.mock.calls.map(([req]) => req.refs)).toEqual([
        input.slice(0, 100),
        [v1],
      ])
      expect(records.size).toBe(100)
      expect(records.get(genericRecordKey(v1))).toBeNull()
      expectFound(records.get(genericRecordKey(v2)), docUri, 'v2')
    })

    it('rejects the whole call without later requests when a request fails', async () => {
      const error = new Error('dataplane unavailable')
      using byURI = mockByURI()
      byURI
        .mockImplementationOnce(byURI.getMockImplementation()!)
        .mockRejectedValueOnce(error)
      await expect(hydrator.getRecordsByURI(uriList(201))).rejects.toThrow(
        error,
      )
      expect(byURI).toHaveBeenCalledTimes(2)

      using byRef = mockByRef()
      byRef
        .mockImplementationOnce(byRef.getMockImplementation()!)
        .mockRejectedValueOnce(error)
      await expect(hydrator.getRecordsByRef(refList(201))).rejects.toThrow(
        error,
      )
      expect(byRef).toHaveBeenCalledTimes(2)
    })
  })
})

describe('ExternalHydrator site.standard lookups', () => {
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(() => {}),
  )
  const hydrator = new ExternalHydrator(dataplane)

  const doc = site.standard.document.$build({
    site: pubUri,
    path: '/post',
    title: 'Document',
    publishedAt: '2026-10-01T00:00:00.000Z',
  })
  const pub = site.standard.publication.$build({
    url: 'https://example.com',
    name: 'Publication',
  })
  const found = (uri: AtUriString, cid: string, body: object) => ({
    ref: { uri, cid },
    status: RecordLookupStatus.FOUND,
    record: { cid, record: Buffer.from(lexStringify(body)) },
  })
  const notFound = (uri: AtUriString) => ({
    ref: { uri },
    status: RecordLookupStatus.NOT_FOUND,
  })
  const key = (uri: AtUriString, cid: string) => genericRecordKey({ uri, cid })

  describe('getSiteStandardRecordsByRef', () => {
    it('short-circuits when no refs are site.standard records with a cid', async () => {
      using byRef = vi.spyOn(dataplane, 'getRecordsByRef')
      const res = await hydrator.getSiteStandardRecordsByRef([
        { uri: 'at://did:plc:a/app.bsky.feed.post/1' as AtUriString, cid: 'x' },
        { uri: docUri },
      ])
      expect(res.documents.size).toBe(0)
      expect(byRef).not.toHaveBeenCalled()
    })

    it('hydrates exact versions into the matching maps', async () => {
      const refs: ItemRef[] = [
        { uri: docUri, cid: docCid },
        { uri: pubUri, cid: pubCid },
      ]
      using byRef = vi.spyOn(dataplane, 'getRecordsByRef').mockResolvedValue(
        new GetRecordsByRefResponse({
          results: [found(docUri, docCid, doc), found(pubUri, pubCid, pub)],
        }),
      )
      const res = await hydrator.getSiteStandardRecordsByRef(refs)
      expect(byRef).toHaveBeenCalledExactlyOnceWith({ refs })
      expect(res.documents.get(key(docUri, docCid))?.record).toEqual(doc)
      expect(res.publications.get(key(pubUri, pubCid))?.record).toEqual(pub)
    })

    it('does not fetch a document-referenced publication that was not pinned', async () => {
      using byRef = vi.spyOn(dataplane, 'getRecordsByRef').mockResolvedValue(
        new GetRecordsByRefResponse({
          results: [found(docUri, docCid, doc)],
        }),
      )
      const res = await hydrator.getSiteStandardRecordsByRef([
        { uri: docUri, cid: docCid },
      ])
      expect(byRef).toHaveBeenCalledOnce()
      expect(res.publications.size).toBe(0)
    })

    it('records missing and invalid versions as null', async () => {
      using _ = vi.spyOn(dataplane, 'getRecordsByRef').mockResolvedValue(
        new GetRecordsByRefResponse({
          results: [
            notFound(docUri),
            found(pubUri, pubCid, { ...pub, name: 42 }),
          ],
        }),
      )
      const res = await hydrator.getSiteStandardRecordsByRef([
        { uri: docUri, cid: docCid },
        { uri: pubUri, cid: pubCid },
      ])
      expect(res.documents.get(key(docUri, docCid))).toBeNull()
      expect(res.publications.get(key(pubUri, pubCid))).toBeNull()
    })
  })
})
