import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it as baseIt, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  atUri,
  lexStringify,
} from '@atproto/lex'
import { site, social } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import {
  GetAtmosphereBacklinkCountsResponse,
  GetAtmosphereBacklinksResponse,
  GetRecordsByURIResponse,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import type { Actors } from './actor.js'
import {
  HydrateCtx,
  Hydrator,
  type HydratorConfig,
  mergeStates,
} from './hydrator.js'
import type { Labels } from './label.js'
import { HydrationMap } from './util.js'

const pubUri = atUri('did:plc:pub', site.standard.publication.$type, 'self')
const pub2Uri = atUri('did:plc:pub2', site.standard.publication.$type, 'self')
const doc1 = atUri('did:plc:author', site.standard.document.$type, '1')
const doc2 = atUri('did:plc:author', site.standard.document.$type, '2')
const httpDoc = atUri('did:plc:author', site.standard.document.$type, 'http')
const badDoc = atUri('did:plc:author', site.standard.document.$type, 'bad')
const missingDoc = atUri(
  'did:plc:author',
  site.standard.document.$type,
  'missing',
)
const missingPubDoc = atUri(
  'did:plc:author',
  site.standard.document.$type,
  'missingpub',
)
const missingPub = atUri(
  'did:plc:nobody',
  site.standard.publication.$type,
  'self',
)

const recommendUri = (did: DidString, rkey: string) =>
  atUri(did, site.standard.graph.recommend.$type, rkey)
const subscriptionUri = (did: DidString, rkey: string) =>
  atUri(did, site.standard.graph.subscription.$type, rkey)

const makeDoc = (siteValue: AtUriString | `https://${string}`) =>
  site.standard.document.$build({
    site: siteValue,
    path: '/post',
    title: 'Document',
    publishedAt: '2026-10-01T00:00:00.000Z',
  })
const makePub = () =>
  site.standard.publication.$build({
    url: 'https://example.com',
    name: 'Publication',
  })
const makeRecommend = (document: AtUriString) =>
  site.standard.graph.recommend.$build({
    document,
    createdAt: '2026-10-01T00:00:00.000Z',
  })
const makeSubscription = (publication: AtUriString) =>
  site.standard.graph.subscription.$build({ publication })

function createFixture() {
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(() => {}),
  )
  const hydrator = new Hydrator(dataplane, [], {} as HydratorConfig)
  const ctx = new HydrateCtx({
    labelers: { dids: [], redact: new Set() },
    viewer: null,
    features: {} as never,
  })

  const records = new Map<AtUriString, { body: object; takenDown?: boolean }>()
  const backlinks = new Map<AtUriString, AtUriString[]>()
  const counts = new Map<AtUriString, Record<string, bigint>>()
  const seedBasic = () => {
    records.set(pubUri, { body: makePub() })
    records.set(doc1, { body: makeDoc(pubUri) })
    records.set(doc2, { body: makeDoc(pubUri) })
    const recs = [
      recommendUri('did:plc:a', '1'),
      recommendUri('did:plc:b', '2'),
      recommendUri('did:plc:c', '3'),
      recommendUri('did:plc:d', '4'),
      recommendUri('did:plc:e', '5'),
    ]
    for (const uri of recs) {
      records.set(uri, { body: makeRecommend(doc1) })
    }
    backlinks.set(doc1, recs)
    const subs = [
      subscriptionUri('did:plc:s1', '1'),
      subscriptionUri('did:plc:s2', '2'),
    ]
    for (const uri of subs) {
      records.set(uri, { body: makeSubscription(pubUri) })
    }
    backlinks.set(pubUri, subs)
    counts.set(doc1, { [site.standard.graph.recommend.$type]: 42n })
    counts.set(pubUri, { [site.standard.graph.subscription.$type]: 17n })
    return { recs, subs }
  }

  return {
    dataplane,
    hydrator,
    ctx,
    records,
    backlinks,
    counts,
    seedBasic,
  }
}

const it = baseIt.extend<{ fixture: ReturnType<typeof createFixture> }>({
  // eslint-disable-next-line no-empty-pattern -- Vitest requires destructured fixture dependencies.
  fixture: async ({}, use) => {
    const fixture = createFixture()
    const { dataplane, hydrator, records, backlinks, counts } = fixture
    using _lookup = vi.spyOn(dataplane, 'getRecordsByURI').mockImplementation(
      async ({ uris = [] }) =>
        new GetRecordsByURIResponse({
          results: uris.map((uri) => {
            const entry = records.get(uri as AtUriString)
            if (!entry)
              return { ref: { uri }, status: RecordLookupStatus.NOT_FOUND }
            return {
              ref: { uri },
              status: entry.takenDown
                ? RecordLookupStatus.TAKEN_DOWN
                : RecordLookupStatus.FOUND,
              record: {
                cid: `cid-${uri}`,
                record: Buffer.from(lexStringify(entry.body)),
                takenDown: entry.takenDown,
              },
            }
          }),
        }),
    )
    using _links = vi
      .spyOn(dataplane, 'getAtmosphereBacklinks')
      .mockImplementation(
        async ({ targetUri, collection, limit }) =>
          new GetAtmosphereBacklinksResponse({
            // @NOTE Ignore the limit to verify hydration bounds the response too.
            backlinks: (backlinks.get(targetUri as AtUriString) ?? [])
              .filter((uri) => uri.includes(`/${collection}/`))
              .slice(0, limit ? limit + 2 : undefined)
              .map((uri) => ({ uri })),
          }),
      )
    using _totals = vi
      .spyOn(dataplane, 'getAtmosphereBacklinkCounts')
      .mockImplementation(
        async ({ targetUris = [] }) =>
          new GetAtmosphereBacklinkCountsResponse({
            results: targetUris.map((targetUri) => ({
              targetUri,
              counts: counts.get(targetUri as AtUriString) ?? {},
            })),
          }),
      )
    using _labels = vi
      .spyOn(hydrator.label, 'getLabelsForSubjects')
      .mockImplementation(async (subjects) => {
        const labels = new HydrationMap() as Labels
        for (const subject of subjects) labels.set(subject, null)
        return labels
      })
    using _profiles = vi
      .spyOn(hydrator, 'hydrateProfilesBasic')
      .mockImplementation(async (dids) => ({
        actors: new HydrationMap(
          dids.map((did) => [did, { did }]),
        ) as unknown as Actors,
      }))
    await use(fixture)
  },
})

describe('Hydrator.hydrateExternalViewDependencies', () => {
  it('hydrates publications, bounded backlink samples, counts, labels, and profiles', async ({
    fixture,
  }) => {
    const { hydrator, ctx, dataplane, seedBasic } = fixture
    const { recs, subs } = seedBasic()
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [doc1, doc2],
      ctx,
    )

    expect(state.externalRecords?.get(pubUri)?.record).toMatchObject({
      name: 'Publication',
    })
    expect(state.externalRecords?.get(doc1)).toBeTruthy()
    expect(state.externalRecords?.get(doc2)).toBeTruthy()

    expect(state.externalRecordsByRef?.has(`${doc1}@cid-${doc1}`)).toBe(true)
    expect(state.siteStandardDocuments?.has(`${doc1}@cid-${doc1}`)).toBe(true)
    expect(state.labels?.has(doc1)).toBe(true)

    expect(state.externalRecordBacklinks?.get(doc1)).toEqual(recs.slice(0, 3))
    expect(state.externalRecordBacklinks?.get(doc2)).toEqual([])
    expect(state.externalRecordBacklinks?.get(pubUri)).toEqual(subs)
    expect(
      state.externalRecordBacklinkCounts?.get(doc1)?.[
        site.standard.graph.recommend.$type
      ],
    ).toBe(42)
    expect(
      state.externalRecordBacklinkCounts?.get(pubUri)?.[
        site.standard.graph.subscription.$type
      ],
    ).toBe(17)

    for (const uri of [...recs.slice(0, 3), ...subs]) {
      expect(state.externalRecords?.get(uri)).toBeTruthy()
      expect(state.labels?.has(uri)).toBe(true)
    }
    expect(state.externalRecords?.has(recs[3])).toBe(false)
    for (const did of [
      'did:plc:a',
      'did:plc:s1',
      'did:plc:pub',
    ] as DidString[]) {
      expect(state.actors?.has(did)).toBe(true)
    }

    expect(dataplane.getAtmosphereBacklinkCounts).toHaveBeenCalledTimes(2)
    expect(embedSpy).toHaveBeenCalledTimes(3)
    expect(embedSpy.mock.calls[1][0].toSorted()).toEqual(
      [pubUri, ...recs.slice(0, 3)].toSorted(),
    )
    expect(embedSpy.mock.calls[2][0].toSorted()).toEqual(subs.toSorted())
  })

  it('does not hydrate http sites, invalid, or unavailable records', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records, dataplane } = fixture
    records.set(httpDoc, { body: makeDoc('https://example.com') })
    records.set(badDoc, { body: { $type: site.standard.document.$type } })
    records.set(missingPubDoc, { body: makeDoc(missingPub) })
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [httpDoc, badDoc, missingDoc, missingPubDoc],
      ctx,
    )
    const lookups = vi
      .mocked(dataplane.getRecordsByURI)
      .mock.calls.flatMap(([req]) => req.uris)
    expect(lookups).not.toContain('https://example.com')
    expect(state.externalRecordBacklinks?.has(httpDoc)).toBe(true)
    expect(state.externalRecordBacklinks?.has(badDoc)).toBe(false)
    expect(state.externalRecordBacklinks?.has(missingDoc)).toBe(false)
    expect(state.externalRecordBacklinkCounts?.has(badDoc)).toBe(false)
    expect(state.externalRecordBacklinkCounts?.has(missingDoc)).toBe(false)
    expect(state.externalRecords?.has(missingPub)).toBe(true)
    expect(state.externalRecords?.get(missingPub)).toBeNull()
    expect(state.externalRecordBacklinks?.has(missingPub)).toBe(false)
    expect(
      embedSpy.mock.calls.filter(([uris]) => uris.includes(missingPub)),
    ).toHaveLength(1)
  })

  it('discards backlinks outside the expected collection and dedupes', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records, dataplane } = fixture
    records.set(doc1, { body: makeDoc('https://example.com') })
    const rec = recommendUri('did:plc:a', '1')
    records.set(rec, { body: makeRecommend(doc1) })
    vi.mocked(dataplane.getAtmosphereBacklinks).mockResolvedValue(
      new GetAtmosphereBacklinksResponse({
        backlinks: [
          { uri: rec },
          { uri: rec },
          { uri: subscriptionUri('did:plc:z', '1') },
        ],
      }),
    )
    const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
    expect(state.externalRecordBacklinks?.get(doc1)).toEqual([rec])
  })

  it('does not rehydrate seen records', async ({ fixture }) => {
    const { hydrator, ctx, records, seedBasic } = fixture
    seedBasic()
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
    await hydrator.hydrateEmbedExternalViewFromUris([doc1, pubUri], ctx)
    expect(embedSpy).toHaveBeenCalledTimes(2)
    expect(embedSpy.mock.calls[1][0]).toHaveLength(5)
    expect(embedSpy.mock.calls[1][0]).not.toContain(pubUri)

    embedSpy.mockClear()
    const seen = new Set<AtUriString>([pubUri, doc1, ...records.keys()])
    await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, seen)
    expect(embedSpy).toHaveBeenCalledTimes(1)
  })

  it('expands discovered publications and honors takedowns', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records, backlinks } = fixture
    records.set(doc1, { body: makeDoc(pub2Uri) })
    records.set(pub2Uri, { body: makePub(), takenDown: true })
    const sub = subscriptionUri('did:plc:s1', '1')
    records.set(sub, { body: makeSubscription(pub2Uri) })
    backlinks.set(pub2Uri, [sub])

    const hidden = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
    expect(hidden.externalRecords?.get(pub2Uri)).toBeNull()
    expect(hidden.externalRecordBacklinks?.has(pub2Uri)).toBe(false)

    const included = await hydrator.hydrateEmbedExternalViewFromUris(
      [doc1],
      ctx.copy({ includeTakedowns: true }),
    )
    expect(included.externalRecords?.get(pub2Uri)).toBeTruthy()
    expect(included.externalRecordBacklinks?.get(pub2Uri)).toEqual([sub])
    expect(included.externalRecords?.get(sub)).toBeTruthy()
  })
  it('retains already hydrated unavailable records across nested dependency passes', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records, backlinks, dataplane } = fixture
    const sub = subscriptionUri('did:plc:subscriber', '1')
    records.set(doc1, { body: makeDoc(pubUri) })
    records.set(pubUri, { body: makePub() })
    backlinks.set(pubUri, [sub])
    const externalRecords = await hydrator.external.getRecordsByURI([doc1, sub])
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

    const dependencies = await hydrator.hydrateExternalViewDependencies(
      { ctx, externalRecords },
      [doc1],
      ctx,
    )
    const state = mergeStates({ ctx, externalRecords }, dependencies)

    expect(embedSpy).toHaveBeenCalledTimes(1)
    expect(embedSpy.mock.calls[0][0]).toEqual([pubUri])
    expect(state.externalRecords?.get(sub)).toBeNull()
    expect(state.externalRecordBacklinks?.get(pubUri)).toEqual([sub])
    const attempts = vi
      .mocked(dataplane.getRecordsByURI)
      .mock.calls.flatMap(([request]) => request.uris ?? [])
      .filter((uri) => uri === sub)
    expect(attempts).toHaveLength(1)
  })

  it('ignores publication sites that are not complete DID-based record URIs', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records } = fixture
    const sites: AtUriString[] = [
      atUri('publisher.example', site.standard.publication.$type, 'self'),
      `at://did:plc:pub/${site.standard.publication.$type}`,
      `${pubUri}#/name`,
      atUri('did:plc:pub', site.standard.document.$type, 'self'),
    ]
    const uris = sites.map((siteValue, i) => {
      const uri = atUri(
        'did:plc:author',
        site.standard.document.$type,
        `invalid-${i}`,
      )
      records.set(uri, { body: makeDoc(siteValue) })
      return uri
    })
    const externalRecords = await hydrator.external.getRecordsByURI(uris)
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

    await hydrator.hydrateExternalViewDependencies(
      { ctx, externalRecords },
      uris,
      ctx,
    )

    expect(embedSpy).not.toHaveBeenCalled()
  })

  it('ignores incomplete, handle-based, and fragment backlink URIs', async ({
    fixture,
  }) => {
    const { hydrator, ctx, records, dataplane } = fixture
    records.set(doc1, { body: makeDoc('https://example.com') })
    vi.mocked(dataplane.getAtmosphereBacklinks).mockResolvedValue(
      new GetAtmosphereBacklinksResponse({
        backlinks: [
          {
            uri: atUri(
              'liker.example',
              site.standard.graph.recommend.$type,
              '1',
            ),
          },
          { uri: `at://did:plc:liker/${site.standard.graph.recommend.$type}` },
          { uri: `${recommendUri('did:plc:liker', '1')}#/document` },
        ],
      }),
    )
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

    const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

    expect(state.externalRecordBacklinks?.get(doc1)).toEqual([])
    expect(embedSpy).toHaveBeenCalledTimes(1)
  })

  it('does not perform hydration for empty input', async ({ fixture }) => {
    const { hydrator, ctx, dataplane } = fixture
    using depsSpy = vi.spyOn(hydrator, 'hydrateExternalViewDependencies')

    expect(await hydrator.hydrateEmbedExternalViewFromUris([], ctx)).toEqual({
      ctx,
    })
    expect(dataplane.getRecordsByURI).not.toHaveBeenCalled()
    expect(hydrator.label.getLabelsForSubjects).not.toHaveBeenCalled()
    expect(hydrator.hydrateProfilesBasic).not.toHaveBeenCalled()
    expect(depsSpy).not.toHaveBeenCalled()
  })

  describe('generic URI dispatch', () => {
    const otherUri = atUri('did:plc:other', social.grain.gallery.$type, '1')
    const other2Uri = atUri('did:plc:other2', social.grain.gallery.$type, '2')
    const fakeDocUri = atUri('did:plc:fake', social.grain.gallery.$type, 'doc')
    const fakePubUri = atUri('did:plc:fake', social.grain.gallery.$type, 'pub')
    const docAsPubUri = atUri(
      'did:plc:fake',
      site.standard.document.$type,
      'pubbody',
    )
    const pubAsDocUri = atUri(
      'did:plc:fake',
      site.standard.publication.$type,
      'docbody',
    )

    it('hydrates records, labels, and profiles for non-Standard-Site-only input', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      records.set(otherUri, {
        body: { $type: social.grain.gallery.$type, a: 1 },
      })
      records.set(other2Uri, {
        body: { $type: social.grain.gallery.$type, a: 2 },
      })
      using depsSpy = vi.spyOn(hydrator, 'hydrateExternalViewDependencies')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [otherUri, other2Uri, otherUri],
        ctx,
      )

      expect(depsSpy).toHaveBeenCalledTimes(1)
      expect(depsSpy.mock.calls[0][1]).toEqual([otherUri, other2Uri])

      expect(state.externalRecords?.get(otherUri)?.record).toMatchObject({
        a: 1,
      })
      expect(state.externalRecords?.get(other2Uri)).toBeTruthy()
      expect(
        state.externalRecordsByRef?.has(`${otherUri}@cid-${otherUri}`),
      ).toBe(true)
      expect(state.labels?.has(otherUri)).toBe(true)
      expect(state.labels?.has(other2Uri)).toBe(true)
      expect(state.actors?.has('did:plc:other' as DidString)).toBe(true)
      expect(state.actors?.has('did:plc:other2' as DidString)).toBe(true)

      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(dataplane.getAtmosphereBacklinkCounts).not.toHaveBeenCalled()
      expect(state.externalRecordBacklinks?.size ?? 0).toBe(0)
    })

    it('expands only supported collections in mixed input', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane, seedBasic } = fixture
      seedBasic()
      records.set(otherUri, { body: { $type: social.grain.gallery.$type } })
      using depsSpy = vi.spyOn(hydrator, 'hydrateExternalViewDependencies')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [otherUri, doc1],
        ctx,
      )

      expect(depsSpy.mock.calls[0][1]).toEqual([otherUri, doc1])
      expect(state.externalRecords?.get(otherUri)).toBeTruthy()
      expect(state.labels?.has(otherUri)).toBe(true)
      expect(state.actors?.has('did:plc:other' as DidString)).toBe(true)
      const backlinkTargets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(backlinkTargets).toEqual(expect.arrayContaining([doc1, pubUri]))
      expect(backlinkTargets).not.toContain(otherUri)
      expect(state.externalRecordBacklinks?.has(otherUri)).toBe(false)
      expect(state.externalRecordBacklinkCounts?.has(otherUri)).toBe(false)
      expect(state.externalRecordBacklinks?.has(doc1)).toBe(true)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
    })

    it('does not follow URI collection and record schema mismatches', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      records.set(fakeDocUri, { body: makeDoc(pubUri) })
      records.set(fakePubUri, { body: makePub() })
      records.set(docAsPubUri, { body: makePub() })
      records.set(pubAsDocUri, { body: makeDoc(pubUri) })
      records.set(pubUri, { body: makePub() })
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [fakeDocUri, fakePubUri, docAsPubUri, pubAsDocUri],
        ctx,
      )

      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(dataplane.getAtmosphereBacklinkCounts).not.toHaveBeenCalled()
      const lookups = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris)
      expect(lookups).not.toContain(pubUri)
      expect(state.externalRecords?.has(pubUri)).toBe(false)
      expect(state.externalRecordBacklinks?.size ?? 0).toBe(0)
      for (const uri of [fakeDocUri, fakePubUri, docAsPubUri, pubAsDocUri]) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
        expect(state.labels?.has(uri)).toBe(true)
      }
    })
  })
})
