import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it as baseIt, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  atUri,
  lexStringify,
} from '@atproto/lex'
import { place, site, social } from '../lexicons/index.js'
import { hydrationLogger } from '../logger.js'
import { Service } from '../proto/bsky_connect.js'
import {
  GetAtmosphereBacklinkCountsResponse,
  GetAtmosphereBacklinksResponse,
  GetRecordsByRefResponse,
  GetRecordsByURIResponse,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import { events } from '../telemetry/events.js'
import type { Actors } from './actor.js'
import { ExternalHydrator, genericRecordKey } from './external.js'
import {
  HydrateCtx,
  Hydrator,
  type HydratorConfig,
  mergeStates,
} from './hydrator.js'
import { Labels } from './label.js'
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

// The exact key of the version the faked `getRecordsByURI` returns.
const fetchedKey = (uri: AtUriString) =>
  genericRecordKey({ uri, cid: `cid-${uri}` })

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
  // Subjects with an actionable takedown label, and owner DIDs whose actor
  // hydrates as explicitly unavailable (`null`).
  const takedownLabeled = new Set<string>()
  const unavailableOwners = new Set<string>()
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
    takedownLabeled,
    unavailableOwners,
    seedBasic,
  }
}

type Fixture = ReturnType<typeof createFixture>
const chainUri = (n: number) =>
  atUri('did:plc:chain', site.standard.document.$type, `c${n}`)
// A synthetic chain of distinct documents: each document's recommend
// backlinks (from the faked dataplane) return the next document.
const seedChain = ({ records, dataplane }: Fixture, length: number) => {
  for (let i = 0; i < length; i++) {
    records.set(chainUri(i), { body: makeDoc('https://example.com') })
  }
  vi.mocked(dataplane.getAtmosphereBacklinks).mockImplementation(
    async ({ targetUri }) => {
      const n = Number(targetUri?.split('/c').pop())
      return new GetAtmosphereBacklinksResponse({
        backlinks: n + 1 < length ? [{ uri: chainUri(n + 1) }] : [],
      })
    },
  )
}
const traversalReports = () =>
  vi
    .mocked(events.externalHydrationTraversal)
    .mock.calls.map(([summary]) => summary)
const labelSubjects = ({ hydrator }: Fixture) =>
  vi
    .mocked(hydrator.label.getLabelsForSubjects)
    .mock.calls.map(([subjects]) => subjects)

const it = baseIt.extend<{ fixture: ReturnType<typeof createFixture> }>({
  // eslint-disable-next-line no-empty-pattern -- Vitest requires destructured fixture dependencies.
  fixture: async ({}, use) => {
    const fixture = createFixture()
    const {
      dataplane,
      hydrator,
      records,
      backlinks,
      counts,
      takedownLabeled,
      unavailableOwners,
    } = fixture
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
        const labels = new Labels()
        for (const subject of subjects) {
          labels.set(subject, {
            isImpersonation: false,
            isTakendown: takedownLabeled.has(subject),
            needsReview: false,
            labels: new HydrationMap(),
          })
        }
        return labels
      })
    using _profiles = vi
      .spyOn(hydrator, 'hydrateProfilesBasic')
      .mockImplementation(async (dids) => ({
        actors: new HydrationMap(
          dids.map((did) => [did, unavailableOwners.has(did) ? null : { did }]),
        ) as unknown as Actors,
      }))
    using _report = vi
      .spyOn(events, 'externalHydrationTraversal')
      .mockImplementation(() => {})
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

    expect(state.externalRecordsByRef?.has(fetchedKey(doc1))).toBe(true)
    expect(state.siteStandardDocuments?.has(fetchedKey(doc1))).toBe(true)
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

  it('dedupes backlinks from the dataplane', async ({ fixture }) => {
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
    // Dataplane output is trusted: only duplicates are collapsed.
    expect(state.externalRecordBacklinks?.get(doc1)).toEqual([
      rec,
      subscriptionUri('did:plc:z', '1'),
    ])
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
    const seen = new Set<string>([pubUri, doc1, ...records.keys()])
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
    // @NOTE The shared traversal tracks completed lookups, including nulls.
    const seenRecordKeys = new Set<string>(externalRecords.keys())
    using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

    const dependencies = await hydrator.hydrateExternalViewDependencies(
      { ctx, externalRecords },
      [{ uri: doc1 }],
      ctx,
      seenRecordKeys,
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
      uris.map((uri) => ({ uri })),
      ctx,
    )

    expect(embedSpy).not.toHaveBeenCalled()
  })

  it('drops backlinks that are not AT-URIs', async ({ fixture }) => {
    const { hydrator, ctx, records, dataplane } = fixture
    records.set(doc1, { body: makeDoc('https://example.com') })
    const rec = recommendUri('did:plc:a', '1')
    records.set(rec, { body: makeRecommend(doc1) })
    vi.mocked(dataplane.getAtmosphereBacklinks).mockResolvedValue(
      new GetAtmosphereBacklinksResponse({
        backlinks: [{ uri: 'not an at-uri' }, { uri: rec }],
      }),
    )
    const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
    expect(state.externalRecordBacklinks?.get(doc1)).toEqual([rec])
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
      expect(depsSpy.mock.calls[0][1]).toEqual([
        { uri: otherUri },
        { uri: other2Uri },
      ])

      expect(state.externalRecords?.get(otherUri)?.record).toMatchObject({
        a: 1,
      })
      expect(state.externalRecords?.get(other2Uri)).toBeTruthy()
      expect(state.externalRecordsByRef?.has(fetchedKey(otherUri))).toBe(true)
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

      expect(depsSpy.mock.calls[0][1]).toEqual([
        { uri: otherUri },
        { uri: doc1 },
      ])
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
  describe('generic takedowns', () => {
    const lookups = (
      dataplane: ReturnType<typeof createFixture>['dataplane'],
    ) =>
      vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris)
    const backlinkTargets = (
      dataplane: ReturnType<typeof createFixture>['dataplane'],
    ) =>
      vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
    const countTargets = (
      dataplane: ReturnType<typeof createFixture>['dataplane'],
    ) =>
      vi
        .mocked(dataplane.getAtmosphereBacklinkCounts)
        .mock.calls.flatMap(([req]) => req.targetUris)

    it('nulls label-takendown roots in both maps without expanding them', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic, takedownLabeled } = fixture
      seedBasic()
      takedownLabeled.add(doc1).add(pubUri)
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, pubUri],
        ctx,
      )

      // Known keys are retained with null values in both maps.
      for (const uri of [doc1, pubUri]) {
        expect(state.externalRecords?.has(uri)).toBe(true)
        expect(state.externalRecords?.get(uri)).toBeNull()
        const key = fetchedKey(uri)
        expect(state.externalRecordsByRef?.has(key)).toBe(true)
        expect(state.externalRecordsByRef?.get(key)).toBeNull()
      }
      // Hidden targets trigger no discovery, backlink, or count queries.
      expect(backlinkTargets(dataplane)).toEqual([])
      expect(countTargets(dataplane)).toEqual([])
      expect(state.externalRecordBacklinks?.size ?? 0).toBe(0)
      expect(state.externalRecordBacklinkCounts?.size ?? 0).toBe(0)
    })

    it('keeps labeled records and expands them with includeTakedowns', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic, takedownLabeled } = fixture
      seedBasic()
      takedownLabeled.add(doc1)
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx.copy({ includeTakedowns: true }),
      )
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecordsByRef?.get(fetchedKey(doc1))).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(backlinkTargets(dataplane)).toContain(doc1)
    })

    it('does not hide a publication because a document is hidden', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic, takedownLabeled } = fixture
      seedBasic()
      takedownLabeled.add(doc1)
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, doc2],
        ctx,
      )
      expect(state.externalRecords?.get(doc1)).toBeNull()
      expect(state.externalRecords?.get(doc2)).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(backlinkTargets(dataplane)).not.toContain(doc1)
      expect(backlinkTargets(dataplane)).toContain(pubUri)
    })

    it('nulls takendown discovered publications and their dependencies are not expanded', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic, takedownLabeled } = fixture
      const { subs } = seedBasic()
      takedownLabeled.add(pubUri)
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeNull()
      expect(state.externalRecordsByRef?.get(fetchedKey(pubUri))).toBeNull()
      expect(backlinkTargets(dataplane)).not.toContain(pubUri)
      expect(lookups(dataplane)).not.toContain(subs[0])
    })

    it('nulls takendown recommends and subscriptions, keeping counts and siblings', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic, takedownLabeled } = fixture
      const { recs, subs } = seedBasic()
      takedownLabeled.add(recs[0]).add(subs[0])
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      for (const uri of [recs[0], subs[0]]) {
        expect(state.externalRecords?.get(uri)).toBeNull()
        expect(state.externalRecordsByRef?.get(fetchedKey(uri))).toBeNull()
      }
      expect(state.externalRecords?.get(recs[1])).toBeTruthy()
      expect(state.externalRecords?.get(subs[1])).toBeTruthy()
      // The target documents and publication stay available.
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      // Samples and aggregate counts are not adjusted for hidden sources.
      expect(state.externalRecordBacklinks?.get(doc1)).toEqual(recs.slice(0, 3))
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
    })

    it('does not retry null or takendown dependencies across passes', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, seedBasic, takedownLabeled } = fixture
      const { recs } = seedBasic()
      takedownLabeled.add(recs[0])
      records.delete(recs[1])
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx)
      // Each dependency is requested by exactly one hydration pass.
      const requested = embedSpy.mock.calls.flatMap(([uris]) => uris)
      for (const uri of [recs[0], recs[1], pubUri]) {
        expect(requested.filter((u) => u === uri)).toHaveLength(1)
      }
    })

    it('hides records of explicitly unavailable owners even with includeTakedowns', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic, unavailableOwners } = fixture
      seedBasic()
      unavailableOwners.add('did:plc:author')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx.copy({ includeTakedowns: true }),
      )
      expect(state.externalRecords?.get(doc1)).toBeNull()
      expect(state.externalRecordsByRef?.get(fetchedKey(doc1))).toBeNull()
      expect(backlinkTargets(dataplane)).toEqual([])
    })

    it('treats an absent actor entry as available', async ({ fixture }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      vi.mocked(hydrator.hydrateProfilesBasic).mockResolvedValue({
        actors: new HydrationMap() as unknown as Actors,
      })
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
    })

    it('hides unavailable owners of dependency records only', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic, unavailableOwners } = fixture
      const { recs } = seedBasic()
      unavailableOwners.add('did:plc:a')
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.get(recs[0])).toBeNull()
      expect(state.externalRecords?.get(recs[1])).toBeTruthy()
    })

    it('hides records of owners taken down by account labels', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic, takedownLabeled } = fixture
      seedBasic()
      // Use real profile hydration: it nulls actors with takedown labels.
      vi.mocked(hydrator.hydrateProfilesBasic).mockRestore()
      vi.spyOn(hydrator.actor, 'getActors').mockImplementation(
        async (dids) =>
          new HydrationMap(
            dids.map((did) => [did, { did, verifications: [] }]),
          ) as unknown as Awaited<ReturnType<typeof hydrator.actor.getActors>>,
      )
      takedownLabeled.add('did:plc:author')
      const hidden = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
      )
      expect(hidden.externalRecords?.get(doc1)).toBeNull()
      expect(hidden.actors?.get('did:plc:author' as DidString)).toBeNull()
      expect(hidden.externalRecordsByRef?.get(fetchedKey(doc1))).toBeNull()
    })

    it('only actions takedown labels from redacting labelers', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic } = fixture
      seedBasic()
      // Use the real label hydrator for this test.
      vi.mocked(hydrator.label.getLabelsForSubjects).mockRestore()
      vi.spyOn(dataplane, 'getLabels').mockResolvedValue({
        labels: [
          Buffer.from(
            JSON.stringify({
              ver: 1,
              src: 'did:plc:plain',
              uri: doc1,
              val: '!takedown',
              cts: '2026-10-01T00:00:00.000Z',
            }),
          ),
        ],
      } as never)
      const labelerCtx = (redact: DidString[]) =>
        ctx.copy({
          labelers: {
            dids: ['did:plc:plain' as DidString],
            redact: new Set(redact),
          },
        })

      const ignored = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        labelerCtx([]),
      )
      expect(ignored.externalRecords?.get(doc1)).toBeTruthy()

      const actioned = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        labelerCtx(['did:plc:plain' as DidString]),
      )
      expect(actioned.externalRecords?.get(doc1)).toBeNull()
    })
  })
  describe('streamplace livestreams', () => {
    const streamUri = atUri(
      'did:plc:streamer',
      place.stream.livestream.$type,
      '1',
    )
    const makeStream = () =>
      place.stream.livestream.$build({
        title: 'Live',
        createdAt: '2026-10-01T00:00:00.000Z',
      })

    it('hydrates records, labels, and owner profiles without dependency work', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      records.set(streamUri, { body: makeStream() })
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [streamUri],
        ctx,
      )

      expect(state.externalRecords?.get(streamUri)).toBeTruthy()
      expect(state.labels?.has(streamUri)).toBe(true)
      expect(state.actors?.has('did:plc:streamer' as DidString)).toBe(true)
      // Profiles are hydrated once, with no nested pass or dependency queries.
      expect(hydrator.hydrateProfilesBasic).toHaveBeenCalledTimes(1)
      expect(embedSpy).toHaveBeenCalledTimes(1)
      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(dataplane.getAtmosphereBacklinkCounts).not.toHaveBeenCalled()
      expect(state.externalRecordBacklinks?.size ?? 0).toBe(0)
    })

    it('keeps Standard Site expansion in mixed batches', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane, seedBasic } = fixture
      seedBasic()
      records.set(streamUri, { body: makeStream() })
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [streamUri, doc1],
        ctx,
      )

      const targets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(targets).toEqual(expect.arrayContaining([doc1, pubUri]))
      expect(targets).not.toContain(streamUri)
      expect(state.externalRecordBacklinks?.has(streamUri)).toBe(false)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.actors?.has('did:plc:streamer' as DidString)).toBe(true)
    })
  })
  describe('grain galleries', () => {
    const owner: DidString = 'did:plc:grain'
    const galleryOf = (rkey: string) =>
      atUri(owner, social.grain.gallery.$type, rkey)
    const photoOf = (rkey: string, did: DidString = owner) =>
      atUri(did, social.grain.photo.$type, rkey)
    const itemOf = (rkey: string) =>
      atUri(owner, social.grain.gallery.item.$type, rkey)
    const favoriteOf = (did: DidString, rkey: string) =>
      atUri(did, social.grain.favorite.$type, rkey)
    const createdAt = '2026-10-01T00:00:00.000Z'
    const makeGallery = () =>
      social.grain.gallery.$build({ title: 'Photos', createdAt })
    const makeItem = (gallery: AtUriString, item: string) =>
      social.grain.gallery.item.$build({
        gallery,
        item: item as AtUriString,
        createdAt,
      })
    // Photo bodies are terminal here, so a minimal body suffices.
    const makePhoto = () => ({ $type: social.grain.photo.$type, alt: 'alt' })

    // Seeds a gallery with `favs` favorites and `items` items, each item
    // pointing to its own photo (owned by `photoOwner`).
    const seedGallery = (
      { records, backlinks, counts }: Fixture,
      gallery: AtUriString,
      favs: number,
      items: number,
      photoOwner: DidString = owner,
    ) => {
      records.set(gallery, { body: makeGallery() })
      const favUris = Array.from({ length: favs }, (_, i) =>
        favoriteOf(
          `did:plc:fan${i}` as DidString,
          `${gallery}-${i}`.replace(/\W/g, ''),
        ),
      )
      for (const uri of favUris) {
        records.set(uri, {
          body: social.grain.favorite.$build({ subject: gallery, createdAt }),
        })
      }
      const key = gallery.split('/').pop()
      const itemUris = Array.from({ length: items }, (_, i) =>
        itemOf(`${key}-${i}`),
      )
      const photoUris = itemUris.map((_, i) =>
        photoOf(`${key}-${i}`, photoOwner),
      )
      itemUris.forEach((uri, i) => {
        records.set(uri, { body: makeItem(gallery, photoUris[i]) })
        records.set(photoUris[i], { body: makePhoto() })
      })
      backlinks.set(gallery, [...favUris, ...itemUris])
      counts.set(gallery, {
        [social.grain.favorite.$type]: 99n,
        [social.grain.gallery.item.$type]: 77n,
      })
      return { favUris, itemUris, photoUris }
    }

    it('hydrates favorites, items, then photos with independent bounds and counts', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const gallery = galleryOf('g1')
      const { favUris, itemUris, photoUris } = seedGallery(
        fixture,
        gallery,
        5,
        12,
        'did:plc:photoowner',
      )
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [gallery],
        ctx,
      )

      // Both source groups are retained, each bounded by its own limit.
      expect(state.externalRecordBacklinks?.get(gallery)).toEqual([
        ...favUris.slice(0, 3),
        ...itemUris.slice(0, 10),
      ])
      const requestedLimits = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => [req.collection, req.limit])
      expect(requestedLimits).toEqual([
        [social.grain.favorite.$type, 3],
        [social.grain.gallery.item.$type, 10],
      ])
      // Counts are one batched call, independent of the samples.
      expect(dataplane.getAtmosphereBacklinkCounts).toHaveBeenCalledTimes(1)
      expect(state.externalRecordBacklinkCounts?.get(gallery)).toEqual({
        [social.grain.favorite.$type]: 99,
        [social.grain.gallery.item.$type]: 77,
      })

      // Pass 1: gallery. Pass 2: sources together. Pass 3: photos together.
      expect(embedSpy).toHaveBeenCalledTimes(3)
      expect(embedSpy.mock.calls[1][0].toSorted()).toEqual(
        [...favUris.slice(0, 3), ...itemUris.slice(0, 10)].toSorted(),
      )
      expect(embedSpy.mock.calls[2][0].toSorted()).toEqual(
        photoUris.slice(0, 10).toSorted(),
      )

      // Records, exact refs, labels, and profiles survive nested passes,
      // including photo owners that weren't in the root batch.
      const photo = photoUris[0]
      expect(state.externalRecords?.get(photo)).toBeTruthy()
      expect(state.externalRecordsByRef?.has(fetchedKey(photo))).toBe(true)
      expect(state.labels?.has(photo)).toBe(true)
      expect(state.actors?.has('did:plc:photoowner' as DidString)).toBe(true)
      expect(state.externalRecords?.has(photoUris[10])).toBe(false)
    })

    it('reports lookups and batches across every nested pass once', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const gallery = galleryOf('g1')
      seedGallery(fixture, gallery, 5, 12)
      await hydrator.hydrateEmbedExternalViewFromUris([gallery], ctx)

      // Gallery, then 3 favorites and 10 items, then 10 photos.
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 24,
          batches: 3,
          maxPass: 3,
        },
      ])
      const fetched = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris ?? [])
      expect(fetched).toHaveLength(24)
    })

    it('hydrates photos for gallery-item-only input without backlink calls', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const gallery = galleryOf('g1')
      const { itemUris, photoUris } = seedGallery(fixture, gallery, 0, 2)
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        itemUris,
        ctx,
      )

      expect(embedSpy).toHaveBeenCalledTimes(2)
      expect(embedSpy.mock.calls[1][0].toSorted()).toEqual(photoUris.toSorted())
      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(dataplane.getAtmosphereBacklinkCounts).not.toHaveBeenCalled()
      expect(state.externalRecordBacklinks?.size ?? 0).toBe(0)
      for (const uri of photoUris) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
      }
    })

    it('batches shared photos once and does not retry unavailable ones', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, backlinks } = fixture
      const g1 = galleryOf('g1')
      const g2 = galleryOf('g2')
      const shared = photoOf('shared')
      const gone = photoOf('gone')
      const hidden = photoOf('hidden')
      records.set(g1, { body: makeGallery() })
      records.set(g2, { body: makeGallery() })
      records.set(shared, { body: makePhoto() })
      records.set(hidden, { body: makePhoto(), takenDown: true })
      const items = [
        [itemOf('a'), g1, shared],
        [itemOf('b'), g2, shared],
        [itemOf('c'), g1, gone],
        [itemOf('d'), g2, hidden],
      ] as const
      for (const [uri, gallery, photo] of items) {
        records.set(uri, { body: makeItem(gallery, photo) })
      }
      backlinks.set(g1, [itemOf('a'), itemOf('c')])
      backlinks.set(g2, [itemOf('b'), itemOf('d')])
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [g1, g2],
        ctx,
      )

      expect(embedSpy).toHaveBeenCalledTimes(3)
      expect(embedSpy.mock.calls[2][0].toSorted()).toEqual(
        [shared, gone, hidden].toSorted(),
      )
      expect(state.externalRecords?.get(shared)).toBeTruthy()
      expect(state.externalRecords?.get(gone)).toBeNull()
      expect(state.externalRecords?.get(hidden)).toBeNull()
      expect(
        embedSpy.mock.calls.flatMap(([uris]) => uris).filter((u) => u === gone),
      ).toHaveLength(1)
    })

    it('bounds total backlink concurrency', async ({ fixture }) => {
      const { hydrator, ctx, dataplane } = fixture
      const galleries = Array.from({ length: 10 }, (_, i) => galleryOf(`g${i}`))
      for (const gallery of galleries) seedGallery(fixture, gallery, 1, 1)
      const impl = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .getMockImplementation()!
      let inFlight = 0
      let peak = 0
      vi.mocked(dataplane.getAtmosphereBacklinks).mockImplementation(
        async (...args) => {
          inFlight++
          peak = Math.max(peak, inFlight)
          await new Promise((resolve) => setTimeout(resolve, 5))
          try {
            return await impl(...args)
          } finally {
            inFlight--
          }
        },
      )
      await hydrator.hydrateEmbedExternalViewFromUris(galleries, ctx)
      const galleryQueries = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.filter(([req]) =>
          (galleries as string[]).includes(req.targetUri ?? ''),
        )
      expect(galleryQueries).toHaveLength(20)
      expect(peak).toBeLessThanOrEqual(8)
      expect(peak).toBeGreaterThan(1)
    })

    it('does not hydrate photos for invalid items or references', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      const gallery = galleryOf('g1')
      const photo = photoOf('p')
      records.set(photo, { body: makePhoto() })
      const bodies: Record<string, object> = {
        invalidBody: { $type: social.grain.gallery.item.$type, gallery },
        wrongCollection: makeItem(gallery, pubUri),
        handleAuthority: makeItem(
          gallery,
          `at://photos.example/${social.grain.photo.$type}/p`,
        ),
        missingRkey: makeItem(
          gallery,
          `at://${owner}/${social.grain.photo.$type}`,
        ),
        fragment: makeItem(gallery, `${photo}#frag`),
      }
      const uris = Object.keys(bodies).map(itemOf)
      Object.entries(bodies).forEach(([key, body]) => {
        records.set(itemOf(key), { body })
      })
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateEmbedExternalViewFromUris(uris, ctx)

      expect(embedSpy).toHaveBeenCalledTimes(1)
      const lookups = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris)
      expect(lookups).not.toContain(photo)
      expect(lookups).not.toContain(pubUri)
    })

    it('preserves Standard Site and Streamplace behavior in mixed batches', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane, seedBasic } = fixture
      seedBasic()
      const streamUri = atUri(
        'did:plc:streamer',
        place.stream.livestream.$type,
        '1',
      )
      records.set(streamUri, {
        body: place.stream.livestream.$build({ title: 'Live', createdAt }),
      })
      const gallery = galleryOf('g1')
      const { photoUris } = seedGallery(fixture, gallery, 1, 1)
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [streamUri, doc1, gallery],
        ctx,
      )

      const targets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(targets).toEqual(expect.arrayContaining([doc1, pubUri, gallery]))
      expect(targets).not.toContain(streamUri)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecords?.get(photoUris[0])).toBeTruthy()
      expect(state.actors?.has('did:plc:streamer' as DidString)).toBe(true)
    })
  })
  describe('traversal control', () => {
    it('fetches each unseen URI once and skips all-seen input', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records } = fixture
      records.set(doc1, { body: makeDoc('https://example.com') })
      records.set(doc2, { body: makeDoc('https://example.com') })
      const seen = new Set<string>([doc2])
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, doc1, doc2],
        ctx,
        seen,
      )
      expect(labelSubjects(fixture)[0]).toEqual([doc1])
      expect(state.externalRecords?.has(doc1)).toBe(true)
      expect(state.externalRecords?.has(doc2)).toBe(false)
      expect(seen.has(doc1)).toBe(true)

      // Everything seen: no hydration work at all, and the state is bare.
      vi.mocked(dataplane.getRecordsByURI).mockClear()
      vi.mocked(hydrator.label.getLabelsForSubjects).mockClear()
      vi.mocked(hydrator.hydrateProfilesBasic).mockClear()
      using depsSpy = vi.spyOn(hydrator, 'hydrateExternalViewDependencies')
      expect(
        await hydrator.hydrateEmbedExternalViewFromUris(
          [doc1, doc2, doc2],
          ctx,
          seen,
        ),
      ).toEqual({ ctx })
      expect(dataplane.getRecordsByURI).not.toHaveBeenCalled()
      expect(hydrator.label.getLabelsForSubjects).not.toHaveBeenCalled()
      expect(hydrator.hydrateProfilesBasic).not.toHaveBeenCalled()
      expect(depsSpy).not.toHaveBeenCalled()
    })

    it('does not retry unavailable records within a shared traversal', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const seen = new Set<string>()
      const first = await hydrator.hydrateEmbedExternalViewFromUris(
        [missingDoc],
        ctx,
        seen,
      )
      expect(first.externalRecords?.get(missingDoc)).toBeNull()
      expect(seen.has(missingDoc)).toBe(true)
      const second = await hydrator.hydrateEmbedExternalViewFromUris(
        [missingDoc],
        ctx,
        seen,
      )
      expect(second).toEqual({ ctx })
      expect(labelSubjects(fixture)).toHaveLength(1)
    })

    it('allows exactly the maximum passes, retaining state and warning once', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = ExternalHydrator.MAX_EXTERNAL_HYDRATION_PASSES
      expect(max).toBe(8)
      seedChain(fixture, max + 4)
      using warn = vi.spyOn(hydrationLogger, 'warn')
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const seen = new Set<string>()
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [chainUri(0)],
        ctx,
        seen,
      )

      expect(embedSpy).toHaveBeenCalledTimes(max)
      expect(
        embedSpy.mock.calls.map(([, , , hydrationPass]) => hydrationPass ?? 1),
      ).toEqual(Array.from({ length: max }, (_, i) => i + 1))
      expect(labelSubjects(fixture)).toHaveLength(max)
      // Partial state is retained; the ninth URI was never fetched or seen.
      for (let i = 0; i < max; i++) {
        expect(state.externalRecords?.get(chainUri(i))).toBeTruthy()
      }
      expect(state.externalRecords?.has(chainUri(max))).toBe(false)
      expect(seen.has(chainUri(max))).toBe(false)
      expect(state.externalRecordBacklinks?.get(chainUri(max - 1))).toEqual([
        chainUri(max),
      ])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toMatchObject({
        hydrationPass: max,
        maxPasses: max,
        skipped: 1,
      })
    })

    it('does not warn when a traversal finishes at or below the limit', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = ExternalHydrator.MAX_EXTERNAL_HYDRATION_PASSES
      using warn = vi.spyOn(hydrationLogger, 'warn')
      seedChain(fixture, max)
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateEmbedExternalViewFromUris([chainUri(0)], ctx)
      expect(embedSpy).toHaveBeenCalledTimes(max)

      seedChain(fixture, 3)
      await hydrator.hydrateEmbedExternalViewFromUris([chainUri(0)], ctx)
      await hydrator.hydrateEmbedExternalViewFromUris([], ctx)
      expect(warn).not.toHaveBeenCalled()
    })

    it('propagates the pass count through direct dependency calls', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = ExternalHydrator.MAX_EXTERNAL_HYDRATION_PASSES
      seedChain(fixture, max + 4)
      const prehydrated = async () => ({
        ctx,
        externalRecords: await hydrator.external.getRecordsByURI([chainUri(0)]),
      })
      using warn = vi.spyOn(hydrationLogger, 'warn')
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

      // Prehydrated state counts as the root batch: passes 2..max remain.
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: chainUri(0) }],
        ctx,
      )
      expect(embedSpy).toHaveBeenCalledTimes(max - 1)
      expect(warn).toHaveBeenCalledTimes(1)

      // A caller already at the last allowed pass fetches nothing further.
      embedSpy.mockClear()
      warn.mockClear()
      const seen = new Set<string>()
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: chainUri(0) }],
        ctx,
        seen,
        max,
      )
      expect(embedSpy).not.toHaveBeenCalled()
      expect(seen.has(chainUri(1))).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })
  describe('exact refs', () => {
    const v = (uri: AtUriString, version: string) => ({
      uri,
      cid: `v${version}`,
    })
    // Versions the faked dataplane returns for `getRecordsByRef`, keyed by
    // `uri@cid`. Anything absent is not found.
    const mockRefs = (
      { dataplane }: Fixture,
      versions: Map<string, { body: object; takenDown?: boolean }>,
    ) =>
      vi
        .spyOn(dataplane, 'getRecordsByRef')
        .mockImplementation(async ({ refs = [] }) => {
          return new GetRecordsByRefResponse({
            results: refs.map(({ uri, cid }) => {
              const entry = versions.get(`${uri}@${cid}`)
              if (!entry) {
                return { ref: { uri }, status: RecordLookupStatus.NOT_FOUND }
              }
              return {
                ref: { uri },
                status: entry.takenDown
                  ? RecordLookupStatus.TAKEN_DOWN
                  : RecordLookupStatus.FOUND,
                record: {
                  cid,
                  record: Buffer.from(lexStringify(entry.body)),
                  takenDown: entry.takenDown,
                },
              }
            }),
          })
        })
    const key = (uri: AtUriString, version: string) =>
      genericRecordKey(v(uri, version))

    it('keeps every requested version and inspects each for dependencies', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane, seedBasic } = fixture
      seedBasic()
      records.set(pub2Uri, { body: makePub() })
      mockRefs(
        fixture,
        new Map([
          [key(doc1, '1'), { body: makeDoc(pubUri) }],
          [key(doc1, '2'), { body: makeDoc(pub2Uri) }],
        ]),
      )
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const seen = new Set<string>()
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1'), v(doc1, '1'), v(doc1, '2')],
        ctx,
        seen,
      )

      // Duplicate refs are fetched once; both versions survive, exact only.
      expect(dataplane.getRecordsByRef).toHaveBeenCalledTimes(1)
      expect(
        vi.mocked(dataplane.getRecordsByRef).mock.calls[0][0].refs,
      ).toHaveLength(2)
      expect(
        state.externalRecordsByRef?.get(key(doc1, '1'))?.record,
      ).toMatchObject({ site: pubUri })
      expect(
        state.externalRecordsByRef?.get(key(doc1, '2'))?.record,
      ).toMatchObject({ site: pub2Uri })
      expect(state.externalRecords?.has(doc1)).toBe(false)
      expect(seen.has(key(doc1, '1'))).toBe(true)
      expect(seen.has(key(doc1, '2'))).toBe(true)
      expect(seen.has(doc1)).toBe(false)

      // Both versions' publications are discovered in one nested batch, and
      // the shared document is a single backlink target.
      expect(embedSpy).toHaveBeenCalledTimes(2)
      // The recommend sources of the shared document ride in the same batch.
      expect(embedSpy.mock.calls[0][0]).toHaveLength(5)
      expect(embedSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([pubUri, pub2Uri]),
      )
      const targets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(targets.filter((t) => t === doc1)).toHaveLength(1)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecords?.get(pub2Uri)).toBeTruthy()
      expect(state.labels?.has(doc1)).toBe(true)
      expect(state.actors?.has('did:plc:author' as DidString)).toBe(true)
    })

    it('fills an unavailable pin only from the same version', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      // Version 2 of doc1 is gone, with no later success. Both pinned
      // publication versions fail as exact lookups, but the latest publication
      // (a dependency of doc1 version 1) returns the CID of one of them.
      const samePub = { uri: pubUri, cid: `cid-${pubUri}` }
      mockRefs(fixture, new Map([[key(doc1, '1'), { body: makeDoc(pubUri) }]]))
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1'), v(doc1, '2'), samePub, v(pubUri, '2')],
        ctx,
      )

      expect(state.externalRecordsByRef?.get(key(doc1, '1'))).toBeTruthy()
      expect(state.externalRecordsByRef?.has(key(doc1, '2'))).toBe(true)
      expect(state.externalRecordsByRef?.get(key(doc1, '2'))).toBeNull()
      // The same URI and CID is the same version, so it fills that pin.
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecordsByRef?.get(fetchedKey(pubUri))).toBeTruthy()
      // A different CID never satisfies the other pin.
      expect(state.externalRecordsByRef?.has(key(pubUri, '2'))).toBe(true)
      expect(state.externalRecordsByRef?.get(key(pubUri, '2'))).toBeNull()
    })

    it('does not suppress later latest lookups', async ({ fixture }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      mockRefs(fixture, new Map([[key(doc1, '1'), { body: makeDoc(pubUri) }]]))
      const seen = new Set<string>()
      await hydrator.hydrateEmbedExternalViewFromRefs([v(doc1, '1')], ctx, seen)
      expect(seen.has(pubUri)).toBe(true)
      expect(seen.has(doc1)).toBe(false)
      const latest = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
        seen,
      )
      expect(latest.externalRecords?.get(doc1)).toBeTruthy()
    })

    it('does not refetch completed exact versions in a shared traversal', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      // Version 2 is unavailable, which is a completed lookup too.
      mockRefs(
        fixture,
        new Map([[key(doc1, '1'), { body: makeDoc('https://example.com') }]]),
      )
      const seen = new Set<string>()
      const first = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1'), v(doc1, '2')],
        ctx,
        seen,
      )
      expect(first.externalRecordsByRef?.get(key(doc1, '1'))).toBeTruthy()
      expect(first.externalRecordsByRef?.get(key(doc1, '2'))).toBeNull()

      vi.mocked(hydrator.label.getLabelsForSubjects).mockClear()
      const again = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '2'), v(doc1, '1'), v(doc1, '2')],
        ctx,
        seen,
      )
      expect(again).toEqual({ ctx })
      expect(dataplane.getRecordsByRef).toHaveBeenCalledTimes(1)
      expect(hydrator.label.getLabelsForSubjects).not.toHaveBeenCalled()
    })

    it('marks direct dependency input refs seen, including unavailable and invalid ones', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const handleDoc = atUri(
        'author.example',
        site.standard.document.$type,
        'handle',
      )
      mockRefs(
        fixture,
        new Map([
          [key(handleDoc, '1'), { body: makeDoc('https://example.com') }],
          [key(badDoc, '1'), { body: { $type: site.standard.document.$type } }],
        ]),
      )
      const exact = [v(doc1, '2'), v(handleDoc, '1'), v(badDoc, '1')]
      const state = {
        ctx,
        externalRecordsByRef: await hydrator.external.getRecordsByRef(exact),
      }
      expect(state.externalRecordsByRef.get(key(doc1, '2'))).toBeNull()

      // `missingDoc` is absent from state; the exact refs are unavailable,
      // non-DID, or schema-invalid records, so none has dependencies.
      const seen = new Set<string>()
      await hydrator.hydrateExternalViewDependencies(
        state,
        [{ uri: missingDoc }, ...exact],
        ctx,
        seen,
      )
      expect([...seen].toSorted()).toEqual(
        [missingDoc, ...exact.map((ref) => genericRecordKey(ref))].toSorted(),
      )
      // Exact keys mark neither the bare URI nor another version.
      expect(seen.has(doc1)).toBe(false)
      expect(seen.has(key(doc1, '1'))).toBe(false)
    })

    it('inspects already-seen and duplicate roots once', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records, seedBasic } = fixture
      seedBasic()
      records.set(pub2Uri, { body: makePub() })
      mockRefs(fixture, new Map([[key(doc1, '1'), { body: makeDoc(pub2Uri) }]]))
      const state = {
        ctx,
        externalRecords: await hydrator.external.getRecordsByURI([doc1]),
        externalRecordsByRef: await hydrator.external.getRecordsByRef([
          v(doc1, '1'),
        ]),
      }
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const seen = new Set<string>([doc1, key(doc1, '1')])
      await hydrator.hydrateExternalViewDependencies(
        state,
        [{ uri: doc1 }, v(doc1, '1'), { uri: doc1 }, v(doc1, '1')],
        ctx,
        seen,
      )

      // Both versions' publications are discovered in one nested batch.
      const nested = embedSpy.mock.calls[0][0]
      expect(nested).toEqual(expect.arrayContaining([pubUri, pub2Uri]))
      expect(new Set(nested).size).toBe(nested.length)
      const targets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(targets.filter((t) => t === doc1)).toHaveLength(1)
      const countTargets = vi
        .mocked(dataplane.getAtmosphereBacklinkCounts)
        .mock.calls.flatMap(([req]) => req.targetUris ?? [])
      expect(countTargets.filter((t) => t === doc1)).toHaveLength(1)
    })

    it('keeps latest and exact lookups of one URI independent', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records } = fixture
      records.set(doc1, { body: makeDoc('https://example.com') })
      const fetched = { uri: doc1, cid: `cid-${doc1}` }
      mockRefs(
        fixture,
        new Map([
          [key(doc1, '1'), { body: makeDoc('https://example.com') }],
          [key(doc1, '2'), { body: makeDoc('https://example.com') }],
          [fetchedKey(doc1), { body: makeDoc('https://example.com') }],
        ]),
      )
      const exactLookups = () =>
        vi
          .mocked(dataplane.getRecordsByRef)
          .mock.calls.flatMap(([req]) => req.refs ?? [])
          .map(({ uri, cid }) =>
            genericRecordKey({ uri: uri as AtUriString, cid }),
          )
      const latestLookups = () =>
        vi
          .mocked(dataplane.getRecordsByURI)
          .mock.calls.flatMap(([req]) => req.uris ?? [])

      // Latest first: the version it returns is not a completed exact lookup.
      const seen = new Set<string>()
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, seen)
      expect(seen.has(fetchedKey(doc1))).toBe(false)
      const latestAfterRoot = latestLookups()
      expect(latestAfterRoot).toContain(doc1)
      for (const ref of [fetched, v(doc1, '1'), v(doc1, '2')]) {
        const state = await hydrator.hydrateEmbedExternalViewFromRefs(
          [ref],
          ctx,
          seen,
        )
        expect(
          state.externalRecordsByRef?.get(genericRecordKey(ref)),
        ).toBeTruthy()
      }
      expect(exactLookups()).toEqual([
        fetchedKey(doc1),
        key(doc1, '1'),
        key(doc1, '2'),
      ])
      expect(latestLookups()).toEqual(latestAfterRoot)

      // Exact first: neither version suppresses the other or the latest.
      vi.mocked(dataplane.getRecordsByRef).mockClear()
      vi.mocked(dataplane.getRecordsByURI).mockClear()
      const reversed = new Set<string>()
      await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '2')],
        ctx,
        reversed,
      )
      await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1')],
        ctx,
        reversed,
      )
      expect(latestLookups()).toEqual([])
      const latest = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
        reversed,
      )
      expect(latest.externalRecords?.get(doc1)).toBeTruthy()
      expect(exactLookups()).toEqual([key(doc1, '2'), key(doc1, '1')])
    })

    it('reports exact roots and latest dependencies as distinct work', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, seedBasic } = fixture
      seedBasic()
      records.set(pub2Uri, { body: makePub() })
      mockRefs(
        fixture,
        new Map([
          [key(doc1, '1'), { body: makeDoc(pubUri) }],
          [key(doc1, '2'), { body: makeDoc(pub2Uri) }],
        ]),
      )
      const seen = new Set<string>()
      // The latest version's CID is still a distinct (unavailable) exact lookup.
      const fetched = { uri: doc1, cid: `cid-${doc1}` }
      await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1'), v(doc1, '1'), v(doc1, '2'), fetched],
        ctx,
        seen,
      )
      // A later latest lookup of the same URI is new work; its dependencies
      // are already seen.
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, seen)

      expect(traversalReports()).toEqual([
        {
          // 3 exact roots, then 2 publications and 3 recommends, then 2
          // subscriptions.
          root: 'refs',
          outcome: 'completed',
          recordLookups: 10,
          batches: 3,
          maxPass: 3,
        },
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 1,
          batches: 1,
          maxPass: 1,
        },
      ])
    })

    it('does nothing for empty input', async ({ fixture }) => {
      const { hydrator, ctx, dataplane } = fixture
      vi.spyOn(dataplane, 'getRecordsByRef')
      expect(await hydrator.hydrateEmbedExternalViewFromRefs([], ctx)).toEqual({
        ctx,
      })
      expect(dataplane.getRecordsByRef).not.toHaveBeenCalled()
      expect(hydrator.label.getLabelsForSubjects).not.toHaveBeenCalled()
      expect(hydrator.hydrateProfilesBasic).not.toHaveBeenCalled()
    })

    it('applies moderation to every exact version independently', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, takedownLabeled, unavailableOwners } =
        fixture
      mockRefs(
        fixture,
        new Map([
          [key(doc1, '1'), { body: makeDoc('https://example.com') }],
          [key(doc1, '2'), { body: makeDoc('https://example.com') }],
          [key(doc2, '1'), { body: makeDoc('https://example.com') }],
          [key(pubUri, '1'), { body: makePub() }],
        ]),
      )
      takedownLabeled.add(doc1)
      unavailableOwners.add('did:plc:pub')
      const refs = [v(doc1, '1'), v(doc1, '2'), v(doc2, '1'), v(pubUri, '1')]
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(refs, ctx)
      expect(state.externalRecordsByRef?.get(key(doc1, '1'))).toBeNull()
      expect(state.externalRecordsByRef?.get(key(doc1, '2'))).toBeNull()
      expect(state.externalRecordsByRef?.get(key(pubUri, '1'))).toBeNull()
      expect(state.externalRecordsByRef?.get(key(doc2, '1'))).toBeTruthy()
      // Hidden roots trigger no dependency work; only doc2 is a target.
      const targets = vi
        .mocked(dataplane.getAtmosphereBacklinks)
        .mock.calls.map(([req]) => req.targetUri)
      expect(targets).toEqual([doc2])

      // includeTakedowns keeps labeled versions but not unavailable owners.
      const included = await hydrator.hydrateEmbedExternalViewFromRefs(
        refs,
        ctx.copy({ includeTakedowns: true }),
      )
      expect(included.externalRecordsByRef?.get(key(doc1, '1'))).toBeTruthy()
      expect(included.externalRecordsByRef?.get(key(doc1, '2'))).toBeTruthy()
      expect(included.externalRecordsByRef?.get(key(pubUri, '1'))).toBeNull()
    })

    it('counts the exact root as the first pass toward the limit', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = ExternalHydrator.MAX_EXTERNAL_HYDRATION_PASSES
      seedChain(fixture, max + 4)
      mockRefs(
        fixture,
        new Map([
          [key(chainUri(0), '1'), { body: makeDoc('https://example.com') }],
        ]),
      )
      using warn = vi.spyOn(hydrationLogger, 'warn')
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(chainUri(0), '1')],
        ctx,
      )
      // One exact root batch plus max - 1 nested URI batches.
      expect(labelSubjects(fixture)).toHaveLength(max)
      expect(state.externalRecords?.has(chainUri(max - 1))).toBe(true)
      expect(state.externalRecords?.has(chainUri(max))).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })

  describe('traversal work telemetry', () => {
    it('reports Standard Site totals across nested passes once', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc1, doc2], ctx)

      expect(embedSpy).toHaveBeenCalledTimes(3)
      // 2 documents, then the publication and 3 recommends, then 2
      // subscriptions.
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 8,
          batches: 3,
          maxPass: 3,
        },
      ])
    })

    it('counts accepted lookups rather than available records', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(httpDoc, { body: makeDoc('https://example.com') })
      records.set(badDoc, { body: { $type: site.standard.document.$type } })
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [missingDoc, badDoc, httpDoc, httpDoc],
        ctx,
      )

      expect(state.externalRecords?.get(missingDoc)).toBeNull()
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 3,
          batches: 1,
          maxPass: 1,
        },
      ])
    })

    it('excludes prior work in supplied seen sets and does not report zero-work calls', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(doc1, { body: makeDoc('https://example.com') })
      records.set(doc2, { body: makeDoc('https://example.com') })
      const seen = new Set<string>()
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, seen)
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx, seen)
      expect(traversalReports().map((r) => r.recordLookups)).toEqual([1, 1])

      vi.mocked(events.externalHydrationTraversal).mockClear()
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx, seen)
      await hydrator.hydrateEmbedExternalViewFromUris([], ctx)
      await hydrator.hydrateEmbedExternalViewFromRefs([], ctx)
      await hydrator.hydrateExternalViewDependencies({ ctx }, [], ctx)
      expect(events.externalHydrationTraversal).not.toHaveBeenCalled()
    })

    it('reports a capped traversal without the skipped lookups', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = ExternalHydrator.MAX_EXTERNAL_HYDRATION_PASSES
      seedChain(fixture, max + 4)
      using warn = vi.spyOn(hydrationLogger, 'warn')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [chainUri(0)],
        ctx,
      )
      expect(state.externalRecords?.has(chainUri(max - 1))).toBe(true)
      expect(state.externalRecords?.has(chainUri(max))).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)

      // Prehydrated state is pass 1, so direct calls fetch from pass 2. A
      // caller already at the cap fetches nothing, but the cap is reported.
      const prehydrated = async () => ({
        ctx,
        externalRecords: await hydrator.external.getRecordsByURI([chainUri(0)]),
      })
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: chainUri(0) }],
        ctx,
      )
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: chainUri(0) }],
        ctx,
        new Set(),
        max,
      )

      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'capped',
          recordLookups: max,
          batches: max,
          maxPass: max,
        },
        {
          root: 'dependencies',
          outcome: 'capped',
          recordLookups: max - 1,
          batches: max - 1,
          maxPass: max,
        },
        {
          root: 'dependencies',
          outcome: 'capped',
          recordLookups: 0,
          batches: 0,
          maxPass: 0,
        },
      ])
    })

    it('reports attempted work once when fetching fails and rethrows', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      seedChain(fixture, 5)
      const lookup = vi
        .mocked(dataplane.getRecordsByURI)
        .getMockImplementation()
      const err = new Error('dataplane failure')
      vi.mocked(dataplane.getRecordsByURI).mockImplementation(
        async (req, options) => {
          if (req.uris?.includes(chainUri(2))) throw err
          return lookup!(req, options)
        },
      )

      await expect(
        hydrator.hydrateEmbedExternalViewFromUris([chainUri(0)], ctx),
      ).rejects.toBe(err)
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'failed',
          recordLookups: 3,
          batches: 3,
          maxPass: 3,
        },
      ])
    })
  })
})
