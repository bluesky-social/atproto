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
  type ExternalRecords,
  type ExternalRecordsByRef,
  genericRecordKey,
  getExternalRootRef,
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

describe(getExternalRootRef, () => {
  const doc = { uri: docUri as AtUriString, cid: docCid }
  const pub = { uri: pubUri as AtUriString, cid: pubCid }
  const other = {
    uri: 'at://did:plc:a/app.example.thing/1' as AtUriString,
    cid: 'other',
  }

  test.each([
    { refs: [doc, pub], expected: doc },
    { refs: [pub, doc], expected: doc },
    { refs: [pub], expected: pub },
    { refs: [other, doc], expected: other },
    { refs: [pub, other, doc], expected: pub },
    { refs: [], expected: undefined },
    { refs: undefined, expected: undefined },
  ])('selects one root from $refs', ({ refs, expected }) => {
    expect(getExternalRootRef(refs)).toBe(expected)
  })

  it('does not inspect the second ref after a document or the tail after a legacy pair', () => {
    const refs = [doc]
    Object.defineProperty(refs, 1, {
      get() {
        throw new Error('second ref inspected')
      },
    })
    expect(getExternalRootRef(refs)).toBe(doc)
    const legacy = [pub, doc]
    Object.defineProperty(legacy, 2, {
      get() {
        throw new Error('tail inspected')
      },
    })
    expect(getExternalRootRef(legacy)).toBe(doc)
  })

  test.each([
    { uri: doc.uri, cid: '' },
    { uri: 'at://example.com/site.standard.document/1', cid: doc.cid },
    { uri: doc.uri + '?query', cid: doc.cid },
    { uri: doc.uri + '#fragment', cid: doc.cid },
    { uri: 'at://did:plc:a', cid: doc.cid },
  ])('does not skip an invalid root to hydrate later refs: $uri', (invalid) => {
    expect(
      getExternalRootRef([
        { ...invalid, uri: invalid.uri as AtUriString },
        doc,
      ]),
    ).toBeUndefined()
  })
})

describe(getSiteStandardRecordsFromRefs, () => {
  const docRef = { uri: docUri as AtUriString, cid: docCid }
  const pubRef = { uri: pubUri as AtUriString, cid: pubCid }
  const doc = site.standard.document.$build({
    site: pubRef.uri,
    path: '/post',
    title: 'Document',
    publishedAt: '2026-10-01T00:00:00.000Z',
  })
  const pub = site.standard.publication.$build({
    url: 'https://example.com',
    name: 'Latest',
  })
  const info = (record: object, cid: string): ExternalRecord => ({
    record: record as ExternalRecord['record'],
    cid,
    sortedAt: new Date(0),
    indexedAt: new Date(0),
    takedownRef: undefined,
  })
  const state = () => ({
    roots: new HydrationMap([
      [genericRecordKey(docRef), info(doc, docCid)],
      [genericRecordKey(pubRef), info({ ...pub, name: 'Pinned' }, pubCid)],
    ]) as ExternalRecordsByRef,
    dependencies: new HydrationMap([
      [pubRef.uri, info(pub, 'latest-pub')],
    ]) as ExternalRecords,
  })
  const empty = { document: undefined, publication: undefined }

  it.each([[docRef, pubRef], [pubRef, docRef], [docRef]])(
    'selects the pinned document and its derived publication for %j',
    (...refs) => {
      const { roots, dependencies } = state()
      const out = getSiteStandardRecordsFromRefs(refs, roots, dependencies)
      expect(out.document?.ref).toEqual(docRef)
      expect(out.document?.info.record).toBe(doc)
      expect(out.publication?.ref).toEqual({
        uri: pubRef.uri,
        cid: 'latest-pub',
      })
      expect(out.publication?.info.record.name).toBe('Latest')
    },
  )

  it('ignores a discarded publication, including its URI and version', () => {
    const { roots, dependencies } = state()
    const out = getSiteStandardRecordsFromRefs(
      [docRef, { uri: otherPubUri as AtUriString, cid: 'wrong' }],
      roots,
      dependencies,
    )
    expect(out.document?.ref).toEqual(docRef)
    expect(out.publication?.ref.uri).toBe(pubRef.uri)
  })

  it('reads a publication root exactly, not from latest dependencies', () => {
    const { roots, dependencies } = state()
    expect(
      getSiteStandardRecordsFromRefs([pubRef], roots, dependencies).publication
        ?.info.record.name,
    ).toBe('Pinned')
    roots.set(genericRecordKey(pubRef), null)
    expect(
      getSiteStandardRecordsFromRefs([pubRef], roots, dependencies),
    ).toEqual(empty)
  })

  it('never falls back from an unavailable document to another version or authored publication', () => {
    const { roots, dependencies } = state()
    roots.set(genericRecordKey(docRef), null)
    roots.set(genericRecordKey({ ...docRef, cid: 'newer' }), info(doc, 'newer'))
    for (const refs of [
      [docRef, pubRef],
      [pubRef, docRef],
    ]) {
      expect(getSiteStandardRecordsFromRefs(refs, roots, dependencies)).toEqual(
        empty,
      )
    }
  })

  it('requires an available, schema-valid publication dependency for an AT-site document', () => {
    const { roots, dependencies } = state()
    expect(getSiteStandardRecordsFromRefs([docRef], roots)).toEqual(empty)
    dependencies.set(pubRef.uri, null)
    expect(
      getSiteStandardRecordsFromRefs([docRef], roots, dependencies),
    ).toEqual(empty)
    dependencies.set(pubRef.uri, info(doc, 'wrong-type'))
    expect(
      getSiteStandardRecordsFromRefs([docRef], roots, dependencies),
    ).toEqual(empty)
    roots.set(genericRecordKey(docRef), info(pub, docCid))
    expect(
      getSiteStandardRecordsFromRefs([docRef], roots, dependencies),
    ).toEqual(empty)
  })

  it('allows a loose URL document without a publication', () => {
    const { roots } = state()
    roots.set(
      genericRecordKey(docRef),
      info({ ...doc, site: 'https://example.com' }, docCid),
    )
    const out = getSiteStandardRecordsFromRefs([docRef], roots)
    expect(out.document?.ref).toEqual(docRef)
    expect(out.publication).toBeUndefined()
  })

  it('does not scan for a Standard.site root behind another collection', () => {
    const { roots, dependencies } = state()
    expect(
      getSiteStandardRecordsFromRefs(
        [
          {
            uri: 'at://did:plc:a/app.example.thing/1' as AtUriString,
            cid: 'other',
          },
          docRef,
        ],
        roots,
        dependencies,
      ),
    ).toEqual(empty)
    expect(getSiteStandardRecordsFromRefs([], roots, dependencies)).toEqual(
      empty,
    )
    expect(
      getSiteStandardRecordsFromRefs(undefined, roots, dependencies),
    ).toEqual(empty)
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
