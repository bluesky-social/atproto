import { EventEmitter, once } from 'node:events'
import {
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { describe, expect, it as baseIt, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  atUri,
  lexStringify,
} from '@atproto/lex'
import { app, place, site, social } from '../lexicons/index.js'
import { hydrationLogger } from '../logger.js'
import { Service } from '../proto/bsky_connect.js'
import {
  GetAtmosphereBacklinkCountsResponse,
  GetAtmosphereBacklinksByActorResponse,
  GetAtmosphereBacklinksResponse,
  GetRecordsByRefResponse,
  GetRecordsByURIResponse,
  RecordLookupStatus,
} from '../proto/bsky_pb.js'
import { events } from '../telemetry/events.js'
import type { Actors, ProfileLinks } from './actor.js'
import {
  type ExternalPublicationSubscriptions,
  MAX_EXTERNAL_HYDRATION_PASSES,
  genericRecordKey,
} from './external.js'
import type { Post } from './feed.js'
import {
  HydrateCtx,
  Hydrator,
  type HydratorConfig,
  mergeStates,
} from './hydrator.js'
import { type Label, Labels } from './label.js'
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

// The dataplane rejects larger generic record requests; the fakes do too.
const DATAPLANE_RECORD_LIMIT = 100
const assertRecordLimit = (count: number) => {
  if (count > DATAPLANE_RECORD_LIMIT) {
    throw new ConnectError(
      `at most ${DATAPLANE_RECORD_LIMIT} URIs are allowed`,
      Code.InvalidArgument,
    )
  }
}

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
const pathUri = (n: number) =>
  atUri(
    'did:plc:path',
    n === 0
      ? site.standard.document.$type
      : n === 1
        ? site.standard.publication.$type
        : site.standard.graph.subscription.$type,
    'p' + n,
  )
// Document → publication → subscription is a valid three-pass dependency path.
const seedPath = ({ records, backlinks }: Fixture, length: number) => {
  for (let i = 0; i < length; i++) {
    const body =
      i === 0
        ? makeDoc(pathUri(1))
        : i === 1
          ? makePub()
          : makeSubscription(pathUri(1))
    records.set(pathUri(i), { body })
  }
  if (length > 2) backlinks.set(pathUri(1), [pathUri(2)])
}
const fullTraversalReports = () =>
  vi
    .mocked(events.externalHydrationTraversal)
    .mock.calls.map(([summary]) => summary)
// Lookup work only; see `fullTraversalReports` for endpoint, timing and counts.
const traversalReports = () =>
  fullTraversalReports().map(
    ({ root, outcome, recordLookups, batches, maxPass }) => ({
      root,
      outcome,
      recordLookups,
      batches,
      maxPass,
    }),
  )
const labelSubjects = ({ hydrator }: Fixture) =>
  vi
    .mocked(hydrator.label.getLabelsForSubjects)
    .mock.calls.map(([subjects]) => subjects)

// Rejects matching dataplane backlink page queries; others use the fixture's.
const failBacklinkPages = (
  { dataplane }: Fixture,
  match: (req: { targetUri?: string; collection?: string }) => boolean,
  err: Error,
) => {
  const impl = vi
    .mocked(dataplane.getAtmosphereBacklinks)
    .getMockImplementation()!
  vi.mocked(dataplane.getAtmosphereBacklinks).mockImplementation(
    async (req, options) => {
      if (match(req)) throw err
      return impl(req, options)
    },
  )
}
// Rejects generic record batches that include a matching URI.
const failRecordBatches = (
  { dataplane }: Fixture,
  match: (uri: string) => boolean,
  err: Error,
) => {
  const impl = vi.mocked(dataplane.getRecordsByURI).getMockImplementation()!
  vi.mocked(dataplane.getRecordsByURI).mockImplementation(
    async (req, options) => {
      if (req.uris?.some(match)) throw err
      return impl(req, options)
    },
  )
}

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
    using _lookup = vi
      .spyOn(dataplane, 'getRecordsByURI')
      .mockImplementation(async ({ uris = [] }) => {
        assertRecordLimit(uris.length)
        return new GetRecordsByURIResponse({
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
        })
      })
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
    expect(state.externalRecordsByRef?.has(fetchedKey(pubUri))).toBe(true)
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

  it.for([
    { kind: 'document', hydration: 'basic', maximum: 2 },
    { kind: 'document', hydration: 'detailed', maximum: 8 },
    { kind: 'publication', hydration: 'basic', maximum: 1 },
    { kind: 'publication', hydration: 'detailed', maximum: 4 },
    { kind: 'livestream', hydration: 'basic', maximum: 1 },
    { kind: 'livestream', hydration: 'detailed', maximum: 1 },
  ] as const)(
    'bounds $kind record lookups at $hydration detail to $maximum',
    async ({ kind, hydration, maximum }, { fixture }) => {
      const { hydrator, ctx, seedBasic, records, backlinks, dataplane } =
        fixture
      const createdAt = '2026-10-01T00:00:00.000Z'
      seedBasic()
      const subscribers = Array.from({ length: 5 }, (_, i) =>
        subscriptionUri(`did:plc:subscriber${i}`, '1'),
      )
      for (const uri of subscribers)
        records.set(uri, { body: makeSubscription(pubUri) })
      backlinks.set(pubUri, subscribers)
      const stream = atUri('did:plc:stream', place.stream.livestream.$type, '1')
      records.set(stream, {
        body: place.stream.livestream.$build({ title: 'Live', createdAt }),
      })
      const uri =
        kind === 'document' ? doc1 : kind === 'publication' ? pubUri : stream
      await hydrator.hydrateEmbedExternalViewFromUris([uri], ctx, { hydration })
      const fetched = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris ?? [])
      expect(fetched).toHaveLength(maximum)
    },
  )

  it('dedupes backlinks and rejects URIs outside the queried record collection', async ({
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
          { uri: doc2 },
          { uri: 'at://did:plc:grain/' + social.grain.gallery.$type + '/1' },
          { uri: rec + '?query' },
          { uri: rec + '#fragment' },
          {
            uri:
              'at://example.com/' + site.standard.graph.recommend.$type + '/1',
          },
          { uri: 'at://did:plc:a/' + site.standard.graph.recommend.$type },
        ],
      }),
    )
    const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
    // Only the queried collection is accepted, and duplicates are collapsed.
    expect(state.externalRecordBacklinks?.get(doc1)).toEqual([rec])
    expect(
      vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris ?? []),
    ).toEqual([doc1, rec])
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
    await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, {
      seenRecordKeys: seen,
    })
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
      { seenRecordKeys },
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

  describe('basic hydration', () => {
    const participantDids = /^did:plc:(?:[a-e]|s\d)$/
    const requestedLabelSubjects = (fixture: Fixture) =>
      labelSubjects(fixture).flat().toSorted()
    const requestedDids = ({ hydrator }: Fixture) =>
      vi
        .mocked(hydrator.hydrateProfilesBasic)
        .mock.calls.flatMap(([dids]) => dids)

    it('keeps content and counts but skips article and publication previews through nested passes', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic } = fixture
      const { recs, subs } = seedBasic()
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
        { hydration: 'basic' },
      )

      // Document, then its discovered publication; the level survives.
      expect(embedSpy.mock.calls.map(([uris]) => uris)).toEqual([
        [doc1],
        [pubUri],
      ])
      expect(
        embedSpy.mock.calls.map(([, , options]) => options?.hydration),
      ).toEqual(['basic', 'basic'])
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()

      // Counts are batched per pass for every target, with no sample queries.
      expect(
        vi
          .mocked(dataplane.getAtmosphereBacklinkCounts)
          .mock.calls.map(([req]) => req.targetUris),
      ).toEqual([[doc1], [pubUri]])
      expect(state.externalRecordBacklinkCounts?.get(doc1)).toEqual({
        [site.standard.graph.recommend.$type]: 42,
      })
      expect(state.externalRecordBacklinkCounts?.get(pubUri)).toEqual({
        [site.standard.graph.subscription.$type]: 17,
      })
      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(state.externalRecordBacklinks?.get(doc1)).toBeUndefined()
      expect(state.externalRecordBacklinks?.get(pubUri)).toBeUndefined()

      // Only content records, their labels and their owners are fetched.
      const fetched = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.flatMap(([req]) => req.uris ?? [])
      expect(fetched).toEqual([doc1, pubUri])
      for (const uri of [...recs, ...subs]) {
        expect(state.externalRecords?.has(uri)).toBeFalsy()
      }
      expect(requestedLabelSubjects(fixture)).toEqual([doc1, pubUri].toSorted())
      expect(state.labels?.has(doc1)).toBe(true)
      expect(state.labels?.has(pubUri)).toBe(true)
      expect(requestedDids(fixture).toSorted()).toEqual([
        'did:plc:author',
        'did:plc:pub',
      ])
      expect(requestedDids(fixture).some((d) => participantDids.test(d))).toBe(
        false,
      )
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 2,
          batches: 2,
          maxPass: 2,
        },
      ])
    })

    it('applies to direct dependency discovery and reports one traversal', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic } = fixture
      seedBasic()
      const externalRecords = await hydrator.external.getRecordsByURI([doc1])
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')

      const dependencies = await hydrator.hydrateExternalViewDependencies(
        { ctx, externalRecords },
        [{ uri: doc1 }],
        ctx,
        { hydration: 'basic' },
      )

      expect(embedSpy).toHaveBeenCalledTimes(1)
      expect(embedSpy.mock.calls[0][0]).toEqual([pubUri])
      expect(embedSpy.mock.calls[0][2]?.hydration).toBe('basic')
      expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      expect(dependencies.externalRecordBacklinkCounts?.get(doc1)).toEqual({
        [site.standard.graph.recommend.$type]: 42,
      })
      expect(dependencies.externalRecordBacklinkCounts?.get(pubUri)).toEqual({
        [site.standard.graph.subscription.$type]: 17,
      })
      expect(dependencies.externalRecords?.get(pubUri)).toBeTruthy()
      expect(traversalReports()).toEqual([
        {
          root: 'dependencies',
          outcome: 'completed',
          recordLookups: 1,
          batches: 1,
          maxPass: 2,
        },
      ])
    })
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
  describe('single Standard.site pipeline', () => {
    const requested = ({ dataplane }: Fixture) =>
      vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.map(([req]) => [...(req.uris ?? [])])

    it('fetches a document, then its publication, once each', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, backlinks } = fixture
      records.set(doc1, { body: makeDoc(pub2Uri) })
      records.set(pub2Uri, { body: makePub() })
      backlinks.clear()
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      expect(requested(fixture)).toEqual([[doc1], [pub2Uri]])
      for (const uri of [doc1, pub2Uri]) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
        expect(state.externalRecordsByRef?.has(fetchedKey(uri))).toBe(true)
        expect(state.labels?.has(uri)).toBe(true)
      }
      // The cross-repo publication owner's profile comes from its own batch.
      expect(state.actors?.has('did:plc:pub2' as DidString)).toBe(true)
    })

    it('combines directly supplied documents and publications in one lookup', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, pubUri], ctx)
      expect(requested(fixture)[0]).toEqual([doc1, pubUri])
      // The directly supplied publication is not fetched again.
      expect(
        requested(fixture)
          .flat()
          .filter((u) => u === pubUri),
      ).toHaveLength(1)
    })

    it('needs one lookup for publications and web-site documents', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(pubUri, { body: makePub() })
      records.set(httpDoc, { body: makeDoc('https://example.com') })
      await hydrator.hydrateEmbedExternalViewFromUris([pubUri], ctx)
      await hydrator.hydrateEmbedExternalViewFromUris([httpDoc], ctx)
      expect(requested(fixture)).toEqual([[pubUri], [httpDoc]])
    })

    it('fetches a shared publication once and keeps missing ones seen', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(pubUri, { body: makePub() })
      records.set(doc1, { body: makeDoc(pubUri) })
      records.set(doc2, { body: makeDoc(pubUri) })
      records.set(missingPubDoc, { body: makeDoc(missingPub) })
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, doc2, missingPubDoc],
        ctx,
      )
      const lookups = requested(fixture)
      expect(lookups).toHaveLength(2)
      expect(lookups[1].toSorted()).toEqual([pubUri, missingPub].toSorted())
      expect(state.externalRecords?.get(missingPub)).toBeNull()
    })

    it('does not follow malformed or wrong-collection references', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(doc1, { body: makeDoc(subscriptionUri('did:plc:s', '1')) })
      records.set(doc2, {
        body: makeDoc('at://handle.example/site.standard.publication/self'),
      })
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx)
      expect(requested(fixture)).toEqual([[doc1, doc2]])
    })

    it('recovers when the referenced publication lookup fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(doc1, { body: makeDoc(pubUri) })
      records.set(pubUri, { body: makePub() })
      failRecordBatches(fixture, (uri) => uri === pubUri, new Error('nope'))
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)
      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.has(pubUri)).toBe(false)
      expect(traversalReports()).toMatchObject([{ outcome: 'partial' }])
    })
  })

  describe('best-effort dependencies', () => {
    it('keeps roots, samples, and publications when counts fail', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic } = fixture
      const { recs, subs } = seedBasic()
      const err = new Error('counts failure')
      vi.mocked(dataplane.getAtmosphereBacklinkCounts).mockRejectedValue(err)
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecordBacklinks?.get(doc1)).toEqual(recs.slice(0, 3))
      expect(state.externalRecordBacklinks?.get(pubUri)).toEqual(subs)
      expect(state.externalRecords?.get(recs[0])).toBeTruthy()
      expect(state.externalRecords?.get(subs[0])).toBeTruthy()
      expect(state.externalRecordBacklinkCounts).toBeUndefined()
      // One failed lookup per pass that discovers backlink targets.
      expect(warn).toHaveBeenCalledTimes(2)
      for (const [fields] of warn.mock.calls) {
        expect(fields).toMatchObject({ err })
      }
      expect(traversalReports()).toMatchObject([{ outcome: 'partial' }])
    })

    it('keeps sibling samples when recommendations fail, distinguishing empty from failed', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      const { subs } = seedBasic()
      const err = new Error('recommend failure')
      failBacklinkPages(
        fixture,
        ({ targetUri, collection }) =>
          targetUri === doc1 &&
          collection === site.standard.graph.recommend.$type,
        err,
      )
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, doc2],
        ctx,
      )

      // Failed lookup is absent; a successful empty lookup is an empty sample.
      expect(state.externalRecordBacklinks?.has(doc1)).toBe(false)
      expect(state.externalRecordBacklinks?.get(doc2)).toEqual([])
      expect(state.externalRecordBacklinks?.get(pubUri)).toEqual(subs)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecords?.get(subs[0])).toBeTruthy()
      expect(
        state.externalRecordBacklinkCounts?.get(doc1)?.[
          site.standard.graph.recommend.$type
        ],
      ).toBe(42)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toMatchObject({
        err,
        uri: doc1,
        collection: site.standard.graph.recommend.$type,
      })
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'partial',
          recordLookups: 5,
          batches: 3,
          maxPass: 3,
        },
      ])
    })

    it('keeps recommendations and the publication when subscriptions fail', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      const { recs } = seedBasic()
      failBacklinkPages(
        fixture,
        ({ collection }) =>
          collection === site.standard.graph.subscription.$type,
        new Error('subscription failure'),
      )
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      expect(state.externalRecordBacklinks?.get(doc1)).toEqual(recs.slice(0, 3))
      expect(state.externalRecordBacklinks?.has(pubUri)).toBe(false)
      expect(state.externalRecords?.get(pubUri)).toBeTruthy()
      expect(state.externalRecords?.get(recs[0])).toBeTruthy()
      expect(
        state.externalRecordBacklinkCounts?.get(pubUri)?.[
          site.standard.graph.subscription.$type
        ],
      ).toBe(17)
    })

    it('continues later fan-out batches after a failed query', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records } = fixture
      const docs = Array.from({ length: 10 }, (_, i) =>
        atUri('did:plc:author', site.standard.document.$type, `fan${i}`),
      )
      for (const doc of docs)
        records.set(doc, { body: makeDoc('https://example.com') })
      failBacklinkPages(
        fixture,
        ({ targetUri }) => targetUri === docs[0],
        new Error('fan-out'),
      )
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(docs, ctx)

      expect(dataplane.getAtmosphereBacklinks).toHaveBeenCalledTimes(10)
      expect(state.externalRecordBacklinks?.has(docs[0])).toBe(false)
      for (const doc of docs.slice(1)) {
        expect(state.externalRecordBacklinks?.get(doc)).toEqual([])
      }
    })

    it('keeps root state when a nested dependency batch fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      const { recs, subs } = seedBasic()
      const err = new Error('nested failure')
      // @NOTE The root wrapper's legacy Standard.site fetch also resolves the
      // publication, so fail on a source record that only nested passes fetch.
      failRecordBatches(fixture, (uri) => uri === recs[0], err)
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      expect(state.externalRecords?.get(doc1)).toBeTruthy()
      expect(state.externalRecordBacklinks?.get(doc1)).toEqual(recs.slice(0, 3))
      expect(state.externalRecordBacklinks?.get(pubUri)).toBeUndefined()
      expect(state.externalRecordBacklinkCounts?.get(doc1)).toBeTruthy()
      // The failed batch is skipped as a whole, including its siblings.
      expect(state.externalRecords?.has(pubUri)).toBe(false)
      expect(state.externalRecords?.has(recs[0])).toBe(false)
      expect(state.externalRecords?.has(subs[0])).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toMatchObject({ err })
      expect(traversalReports()).toMatchObject([{ outcome: 'partial' }])
    })

    it('still rejects and reports failure when the root fetch fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx, seedBasic } = fixture
      seedBasic()
      const err = new Error('root failure')
      failRecordBatches(fixture, (uri) => uri === doc1, err)
      await expect(
        hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx),
      ).rejects.toBe(err)
      expect(traversalReports()).toMatchObject([
        { outcome: 'failed', batches: 1 },
      ])
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

    it('keeps gallery items, photos and counts but skips favorite previews', async ({
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
        { hydration: 'basic' },
      )

      expect(
        vi
          .mocked(dataplane.getRecordsByURI)
          .mock.calls.flatMap(([req]) => req.uris ?? []),
      ).toHaveLength(21)
      // Membership items keep their limit; favorites are never requested.
      expect(
        vi
          .mocked(dataplane.getAtmosphereBacklinks)
          .mock.calls.map(([req]) => [req.collection, req.limit]),
      ).toEqual([[social.grain.gallery.item.$type, 10]])
      expect(state.externalRecordBacklinks?.get(gallery)).toEqual(
        itemUris.slice(0, 10),
      )
      expect(dataplane.getAtmosphereBacklinkCounts).toHaveBeenCalledTimes(1)
      expect(state.externalRecordBacklinkCounts?.get(gallery)).toEqual({
        [social.grain.favorite.$type]: 99,
        [social.grain.gallery.item.$type]: 77,
      })

      // Gallery, then items, then photos, all at the same level.
      expect(embedSpy.mock.calls.map(([uris]) => uris)).toEqual([
        [gallery],
        itemUris.slice(0, 10),
        photoUris.slice(0, 10),
      ])
      expect(
        embedSpy.mock.calls.map(([, , options]) => options?.hydration),
      ).toEqual(['basic', 'basic', 'basic'])
      const photo = photoUris[0]
      expect(state.externalRecords?.get(photo)).toBeTruthy()
      expect(state.labels?.has(photo)).toBe(true)
      expect(state.actors?.has('did:plc:photoowner' as DidString)).toBe(true)
      for (const uri of favUris) {
        expect(state.externalRecords?.has(uri)).toBeFalsy()
      }
      const favorites: string[] = favUris
      expect(
        labelSubjects(fixture)
          .flat()
          .filter((uri) => favorites.includes(uri)),
      ).toEqual([])
      expect(
        vi
          .mocked(hydrator.hydrateProfilesBasic)
          .mock.calls.flatMap(([dids]) => dids)
          .filter((did) => did.startsWith('did:plc:fan')),
      ).toEqual([])
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

    // 11 galleries of 10 items each, so dependency passes exceed the request
    // limit. A root item is already seen when its gallery's items are
    // discovered, and its photo is discovered with the items.
    const seedLargeTraversal = (fixture: Fixture) => {
      const galleries = Array.from({ length: 11 }, (_, i) =>
        galleryOf(`big${i}`),
      )
      const seeded = galleries.map((gallery) =>
        seedGallery(fixture, gallery, 0, 10),
      )
      const itemUris = seeded.flatMap(({ itemUris }) => itemUris)
      const photoUris = seeded.flatMap(({ photoUris }) => photoUris)
      const roots = [...galleries, itemUris[0], galleries[0]]
      return { galleries, itemUris, photoUris, roots }
    }
    const recordRequests = ({ dataplane }: Fixture) =>
      vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.map(([req]) => req.uris ?? [])

    it('chunks large dependency passes without consuming extra passes', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const { galleries, itemUris, photoUris, roots } =
        seedLargeTraversal(fixture)
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(roots, ctx)

      // Pass 2 is 109 unseen items plus the root item's photo; pass 3 is the
      // remaining 109 photos.
      const requests = recordRequests(fixture)
      expect(requests.map((uris) => uris.length)).toEqual([12, 100, 10, 100, 9])
      expect(requests.flat().toSorted()).toEqual(
        [...galleries, ...itemUris, ...photoUris].toSorted(),
      )
      expect(
        embedSpy.mock.calls.map(([, , options]) => options?.hydrationPass ?? 1),
      ).toEqual([1, 2, 3])
      for (const gallery of galleries) {
        expect(state.externalRecordBacklinks?.get(gallery)).toHaveLength(10)
      }
      for (const uri of [...itemUris, ...photoUris]) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
        expect(state.externalRecordsByRef?.has(fetchedKey(uri))).toBe(true)
      }
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 231,
          batches: 3,
          maxPass: 3,
        },
      ])
    })

    it('skips a whole dependency pass when one of its requests fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const { galleries, itemUris, photoUris, roots } =
        seedLargeTraversal(fixture)
      const err = new Error('second request failure')
      const impl = vi.mocked(dataplane.getRecordsByURI).getMockImplementation()!
      // Roots, then the first dependency request, then a failure.
      vi.mocked(dataplane.getRecordsByURI)
        .mockImplementationOnce(impl)
        .mockImplementationOnce(impl)
        .mockRejectedValueOnce(err)
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(roots, ctx)

      expect(recordRequests(fixture).map((uris) => uris.length)).toEqual([
        12, 100, 10,
      ])
      for (const gallery of galleries) {
        expect(state.externalRecords?.get(gallery)).toBeTruthy()
      }
      expect(state.externalRecords?.get(itemUris[0])).toBeTruthy()
      // Records from the successful request are discarded with the batch.
      for (const uri of [...itemUris.slice(1), ...photoUris]) {
        expect(state.externalRecords?.has(uri)).toBe(false)
      }
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ err, hydrationPass: 1, skipped: 110 }),
        'failed to hydrate external view dependencies',
      )
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'partial',
          recordLookups: 122,
          batches: 2,
          maxPass: 2,
        },
      ])
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
    it('keeps items and photos when favorites fail', async ({ fixture }) => {
      const { hydrator, ctx } = fixture
      const gallery = galleryOf('g1')
      const { itemUris, photoUris } = seedGallery(fixture, gallery, 5, 2)
      failBacklinkPages(
        fixture,
        ({ collection }) => collection === social.grain.favorite.$type,
        new Error('favorites failure'),
      )
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [gallery],
        ctx,
      )

      expect(state.externalRecordBacklinks?.get(gallery)).toEqual(itemUris)
      for (const uri of [...itemUris, ...photoUris]) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
      }
      expect(
        state.externalRecordBacklinkCounts?.get(gallery)?.[
          social.grain.favorite.$type
        ],
      ).toBe(99)
    })

    it('keeps the gallery root when its item pages fail', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const gallery = galleryOf('g1')
      const { favUris, itemUris } = seedGallery(fixture, gallery, 2, 2)
      failBacklinkPages(
        fixture,
        ({ collection }) => collection === social.grain.gallery.item.$type,
        new Error('items failure'),
      )
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [gallery],
        ctx,
      )

      expect(state.externalRecords?.get(gallery)).toBeTruthy()
      expect(state.externalRecordBacklinks?.get(gallery)).toEqual(favUris)
      for (const uri of itemUris) {
        expect(state.externalRecords?.has(uri)).toBe(false)
      }
    })

    it('omits the gallery sample entirely when all of its pages fail', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const gallery = galleryOf('g1')
      seedGallery(fixture, gallery, 2, 2)
      failBacklinkPages(fixture, () => true, new Error('pages failure'))
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [gallery],
        ctx,
      )

      expect(state.externalRecords?.get(gallery)).toBeTruthy()
      expect(state.externalRecordBacklinks?.has(gallery)).toBe(false)
      expect(state.externalRecordBacklinkCounts?.get(gallery)).toBeTruthy()
    })

    it('keeps gallery, favorites, and items when photo hydration fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const gallery = galleryOf('g1')
      const { favUris, itemUris, photoUris } = seedGallery(
        fixture,
        gallery,
        2,
        2,
      )
      failRecordBatches(
        fixture,
        (uri) => (photoUris as string[]).includes(uri),
        new Error('photos failure'),
      )
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [gallery],
        ctx,
      )

      for (const uri of [gallery, ...favUris, ...itemUris]) {
        expect(state.externalRecords?.get(uri)).toBeTruthy()
      }
      expect(state.externalRecordBacklinks?.get(gallery)).toEqual([
        ...favUris,
        ...itemUris,
      ])
      for (const uri of photoUris) {
        expect(state.externalRecords?.has(uri)).toBe(false)
      }
      expect(warn).toHaveBeenCalledTimes(1)
      expect(traversalReports()).toMatchObject([{ outcome: 'partial' }])
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
        { seenRecordKeys: seen },
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
          { seenRecordKeys: seen },
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
        { seenRecordKeys: seen },
      )
      expect(first.externalRecords?.get(missingDoc)).toBeNull()
      expect(seen.has(missingDoc)).toBe(true)
      const second = await hydrator.hydrateEmbedExternalViewFromUris(
        [missingDoc],
        ctx,
        { seenRecordKeys: seen },
      )
      expect(second).toEqual({ ctx })
      expect(labelSubjects(fixture)).toHaveLength(1)
    })

    it('allows a nested pass at the limit without resetting its depth', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      using warn = vi.spyOn(hydrationLogger, 'warn')
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      const seen = new Set<string>()
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [pathUri(0)],
        ctx,
        { seenRecordKeys: seen, hydrationPass: max - 1 },
      )
      expect(
        embedSpy.mock.calls.map(([, , options]) => options?.hydrationPass),
      ).toEqual([max - 1, max])
      expect(state.externalRecords?.get(pathUri(0))).toBeTruthy()
      expect(state.externalRecords?.get(pathUri(1))).toBeTruthy()
      expect(state.externalRecords?.has(pathUri(2))).toBe(false)
      expect(seen.has(pathUri(2))).toBe(false)
      expect(state.externalRecordBacklinks?.get(pathUri(1))).toEqual([
        pathUri(2),
      ])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toMatchObject({
        hydrationPass: max,
        maxPasses: max,
        skipped: 1,
      })
    })

    it('does not warn when a traversal finishes at the limit', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      using warn = vi.spyOn(hydrationLogger, 'warn')
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateEmbedExternalViewFromUris([pathUri(0)], ctx, {
        hydrationPass: max - 2,
      })
      expect(
        embedSpy.mock.calls.map(([, , options]) => options?.hydrationPass),
      ).toEqual([max - 2, max - 1, max])
      await hydrator.hydrateEmbedExternalViewFromUris([], ctx)
      expect(warn).not.toHaveBeenCalled()
    })

    it('propagates the pass count through direct dependency calls', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      const prehydrated = async () => ({
        ctx,
        externalRecords: await hydrator.external.getRecordsByURI([pathUri(0)]),
      })
      using warn = vi.spyOn(hydrationLogger, 'warn')
      using embedSpy = vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris')
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: pathUri(0) }],
        ctx,
        { hydrationPass: max - 1 },
      )
      expect(embedSpy).toHaveBeenCalledTimes(1)
      expect(embedSpy.mock.calls[0][2]?.hydrationPass).toBe(max)
      expect(warn).toHaveBeenCalledTimes(1)
      embedSpy.mockClear()
      warn.mockClear()
      const seen = new Set<string>()
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: pathUri(0) }],
        ctx,
        { seenRecordKeys: seen, hydrationPass: max },
      )
      expect(embedSpy).not.toHaveBeenCalled()
      expect(seen.has(pathUri(1))).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })
  describe('publication subscriptions', () => {
    const viewer: DidString = 'did:plc:viewer'

    it.for([false, true])(
      'validates viewer-owned subscription backlinks (truncated: %s)',
      async (truncated, { fixture }) => {
        const { hydrator, ctx, records, dataplane, seedBasic } = fixture
        seedBasic()
        records.set(pub2Uri, { body: makePub() })
        records.set(missingPub, { body: makePub() })
        using byActor = vi
          .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
          .mockResolvedValue(
            new GetAtmosphereBacklinksByActorResponse({
              results: [
                {
                  targetUri: pubUri,
                  uris: [subscriptionUri(viewer, 'valid')],
                },
                {
                  targetUri: pub2Uri,
                  uris: [
                    subscriptionUri('did:plc:other', 'wrong-owner'),
                    recommendUri(viewer, 'wrong-collection'),
                    subscriptionUri(viewer, 'query') + '?query',
                    subscriptionUri(viewer, 'fragment') + '#fragment',
                    'at://viewer.test/' +
                      site.standard.graph.subscription.$type +
                      '/1',
                    `at://${viewer}/${site.standard.graph.subscription.$type}`,
                  ],
                },
              ],
              truncated,
            }),
          )
        const subscriptions: ExternalPublicationSubscriptions =
          new HydrationMap()
        const state = await hydrator.hydrateEmbedExternalViewFromUris(
          [doc1, doc2, pub2Uri, missingPub],
          ctx.copy({ viewer }),
          { hydration: 'basic', publicationSubscriptions: subscriptions },
        )

        expect(state.externalPublicationSubscriptions).toBe(subscriptions)
        expect([...subscriptions]).toEqual([
          [pubUri, true],
          [pub2Uri, truncated ? null : false],
          [missingPub, truncated ? null : false],
        ])
        expect(byActor).toHaveBeenCalledExactlyOnceWith({
          targetUris: [pubUri, pub2Uri, missingPub],
          actorDid: viewer,
          collection: site.standard.graph.subscription.$type,
        })
        expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      },
    )

    it('bounds requests and caches complete, truncated, and failed outcomes across roots', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      const publications = Array.from({ length: 205 }, (_, i) =>
        atUri('did:plc:publisher', site.standard.publication.$type, `p${i}`),
      )
      const documents = publications.map((publication, i) => {
        records.set(publication, { body: makePub() })
        const uri = atUri(
          'did:plc:author',
          site.standard.document.$type,
          `s${i}`,
        )
        records.set(uri, { body: makeDoc(publication) })
        return uri
      })
      const err = new Error('subscription lookup failed')
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      using byActor = vi
        .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
        .mockImplementation(async ({ targetUris = [] }) => {
          assertRecordLimit(targetUris.length)
          if (targetUris[0] === publications[100]) throw err
          return new GetAtmosphereBacklinksByActorResponse({
            results:
              targetUris[0] === publications[0]
                ? [
                    {
                      targetUri: publications[0],
                      uris: [subscriptionUri(viewer, '1')],
                    },
                  ]
                : [],
            truncated: targetUris[0] === publications[0],
          })
        })
      const subscriptions: ExternalPublicationSubscriptions = new HydrationMap()
      const options = {
        hydration: 'basic' as const,
        seenRecordKeys: new Set<string>(),
        publicationSubscriptions: subscriptions,
      }
      const scopedCtx = ctx.copy({ viewer })
      const first = await hydrator.hydrateEmbedExternalViewFromUris(
        publications,
        scopedCtx,
        options,
      )
      const next = await hydrator.hydrateEmbedExternalViewFromUris(
        documents,
        scopedCtx,
        options,
      )
      const state = mergeStates(first, next)

      expect(state.externalPublicationSubscriptions).toBe(subscriptions)
      expect([...subscriptions]).toEqual(
        publications.map((uri, i) => [
          uri,
          i === 0 ? true : i < 200 ? null : false,
        ]),
      )
      const batches = byActor.mock.calls.map(([req]) => req.targetUris ?? [])
      expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5])
      expect(batches.flat()).toEqual(publications)
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        { err },
        'failed to hydrate external publication subscriptions',
      )
      expect(fullTraversalReports().map(({ outcome }) => outcome)).toEqual([
        'partial',
        'completed',
      ])
    })

    it('reserves shared targets before concurrent root lookups can repeat them', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, seedBasic } = fixture
      seedBasic()
      const gate = new EventEmitter()
      const started = once(gate, 'started')
      const response = once(gate, 'response')
      using byActor = vi
        .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
        .mockImplementation(async () => {
          gate.emit('started')
          const [result] = await response
          return result
        })
      const subscriptions: ExternalPublicationSubscriptions = new HydrationMap()
      const options = {
        hydration: 'basic' as const,
        publicationSubscriptions: subscriptions,
      }
      const scopedCtx = ctx.copy({ viewer })
      const first = hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        scopedCtx,
        options,
      )
      await started
      const next = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc2],
        scopedCtx,
        options,
      )
      expect(subscriptions.get(pubUri)).toBeNull()
      gate.emit(
        'response',
        new GetAtmosphereBacklinksByActorResponse({
          results: [
            { targetUri: pubUri, uris: [subscriptionUri(viewer, '1')] },
          ],
        }),
      )
      const state = mergeStates(await first, next)

      expect(byActor).toHaveBeenCalledTimes(1)
      expect(state.externalPublicationSubscriptions?.get(pubUri)).toBe(true)
    })

    it('ignores unvalidated and moderated publication sources', async ({
      fixture,
    }) => {
      const {
        hydrator,
        ctx,
        records,
        dataplane,
        takedownLabeled,
        unavailableOwners,
      } = fixture
      const hidden = atUri('did:plc:hidden', site.standard.document.$type, '1')
      records.set(doc1, { body: makeDoc(pubUri) })
      records.set(doc2, { body: { ...makeDoc(pub2Uri), title: 123 } })
      records.set(hidden, { body: makeDoc(missingPub) })
      records.set(pubUri, { body: makePub() })
      records.set(pub2Uri, { body: { ...makePub(), name: 123 } })
      takedownLabeled.add(doc1)
      takedownLabeled.add(pubUri)
      unavailableOwners.add('did:plc:hidden')
      using byActor = vi.spyOn(dataplane, 'getAtmosphereBacklinksByActor')
      const subscriptions: ExternalPublicationSubscriptions = new HydrationMap()
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, doc2, hidden, pubUri, pub2Uri],
        ctx.copy({ viewer }),
        { hydration: 'basic', publicationSubscriptions: subscriptions },
      )

      expect(state.externalPublicationSubscriptions).toBe(subscriptions)
      expect(subscriptions.size).toBe(0)
      expect(byActor).not.toHaveBeenCalled()
    })

    it.for([
      { viewer, optIn: false },
      { viewer: null, optIn: true },
      { viewer: null, optIn: false },
    ])(
      'makes no subscription calls for $viewer with opt-in $optIn',
      async ({ viewer, optIn }, { fixture }) => {
        const { hydrator, ctx, dataplane, seedBasic } = fixture
        seedBasic()
        using byActor = vi.spyOn(dataplane, 'getAtmosphereBacklinksByActor')
        const subscriptions: ExternalPublicationSubscriptions | undefined =
          optIn ? new HydrationMap() : undefined
        const state = await hydrator.hydrateEmbedExternalViewFromUris(
          [doc1],
          ctx.copy({ viewer }),
          { hydration: 'basic', publicationSubscriptions: subscriptions },
        )

        expect(state.externalRecords?.get(pubUri)?.record).toEqual(makePub())
        expect(state.externalPublicationSubscriptions).toBe(subscriptions)
        expect(subscriptions?.size ?? 0).toBe(0)
        expect(byActor).not.toHaveBeenCalled()
      },
    )
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
          assertRecordLimit(refs.length)
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

    it('shares subscription discovery across URI roots, exact versions, and recursive dependencies', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane, seedBasic } = fixture
      seedBasic()
      records.set(pub2Uri, { body: makePub() })
      const root = recommendUri('did:plc:root', '1')
      records.set(root, { body: makeRecommend(doc1) })
      using _refs = mockRefs(
        fixture,
        new Map([
          [key(doc1, '1'), { body: makeDoc(pubUri) }],
          [key(doc1, '2'), { body: makeDoc(pub2Uri) }],
          [key(pubUri, '1'), { body: makePub() }],
        ]),
      )
      const viewer: DidString = 'did:plc:viewer'
      using byActor = vi
        .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
        .mockImplementation(
          async ({ targetUris = [] }) =>
            new GetAtmosphereBacklinksByActorResponse({
              results: targetUris.map((targetUri) => ({
                targetUri,
                uris:
                  targetUri === pub2Uri ? [subscriptionUri(viewer, '1')] : [],
              })),
            }),
        )
      const subscriptions: ExternalPublicationSubscriptions = new HydrationMap()
      const options = {
        hydration: 'basic' as const,
        seenRecordKeys: new Set<string>(),
        publicationSubscriptions: subscriptions,
      }
      const scopedCtx = ctx.copy({ viewer })
      const uriState = await hydrator.hydrateEmbedExternalViewFromUris(
        [root],
        scopedCtx,
        options,
      )
      const refState = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '1'), v(doc1, '2'), v(pubUri, '1')],
        scopedCtx,
        options,
      )
      const state = mergeStates(uriState, refState)

      expect(state.externalPublicationSubscriptions).toBe(subscriptions)
      expect([...subscriptions]).toEqual([
        [pubUri, false],
        [pub2Uri, true],
      ])
      expect(byActor.mock.calls.map(([req]) => req.targetUris)).toEqual([
        [pubUri],
        [pub2Uri],
      ])
      expect(state.externalRecordsByRef?.get(key(doc1, '1'))?.record).toEqual(
        makeDoc(pubUri),
      )
      expect(state.externalRecordsByRef?.get(key(doc1, '2'))?.record).toEqual(
        makeDoc(pub2Uri),
      )
      expect(state.externalRecords?.get(pub2Uri)?.record).toEqual(makePub())
    })

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
        { seenRecordKeys: seen },
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

    it('chunks exact roots and latest dependencies, keeping identities distinct', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records, dataplane } = fixture
      // 60 documents pinned at two versions, each version referencing its own
      // publication, so both passes exceed the request limit.
      const docs = Array.from({ length: 60 }, (_, i) =>
        atUri('did:plc:author', site.standard.document.$type, `big${i}`),
      )
      const pubOf = (i: number, version: string) =>
        atUri(
          'did:plc:pub',
          site.standard.publication.$type,
          `big${i}v${version}`,
        )
      const versions = new Map<string, { body: object }>()
      const pubs: AtUriString[] = []
      const refs = docs.flatMap((doc, i) =>
        ['1', '2'].map((version) => {
          const pub = pubOf(i, version)
          versions.set(key(doc, version), { body: makeDoc(pub) })
          records.set(pub, { body: makePub() })
          pubs.push(pub)
          return v(doc, version)
        }),
      )
      using _refs = mockRefs(fixture, versions)
      const seen = new Set<string>()
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(
        [...refs, ...refs.slice(0, 5)],
        ctx,
        { seenRecordKeys: seen },
      )

      const refRequests = vi
        .mocked(dataplane.getRecordsByRef)
        .mock.calls.map(([req]) => req.refs ?? [])
      expect(refRequests.map((chunk) => chunk.length)).toEqual([100, 20])
      expect(refRequests.flat()).toEqual(refs)
      const uriRequests = vi
        .mocked(dataplane.getRecordsByURI)
        .mock.calls.map(([req]) => req.uris ?? [])
      expect(uriRequests.map((chunk) => chunk.length)).toEqual([100, 20])
      expect(uriRequests.flat().toSorted()).toEqual(pubs.toSorted())

      // Exact roots are never latest lookups, and vice versa.
      for (const ref of refs) {
        expect(
          state.externalRecordsByRef?.get(genericRecordKey(ref)),
        ).toBeTruthy()
        expect(seen.has(genericRecordKey(ref))).toBe(true)
      }
      for (const doc of docs) {
        expect(state.externalRecords?.has(doc)).toBe(false)
        expect(seen.has(doc)).toBe(false)
      }
      for (const pub of pubs) {
        expect(state.externalRecords?.get(pub)).toBeTruthy()
        expect(state.externalRecordsByRef?.has(fetchedKey(pub))).toBe(true)
        expect(seen.has(pub)).toBe(true)
      }
      expect(traversalReports()).toEqual([
        {
          root: 'refs',
          outcome: 'completed',
          recordLookups: 240,
          batches: 2,
          maxPass: 2,
        },
      ])
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
      await hydrator.hydrateEmbedExternalViewFromRefs([v(doc1, '1')], ctx, {
        seenRecordKeys: seen,
      })
      expect(seen.has(pubUri)).toBe(true)
      expect(seen.has(doc1)).toBe(false)
      const latest = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
        { seenRecordKeys: seen },
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
        { seenRecordKeys: seen },
      )
      expect(first.externalRecordsByRef?.get(key(doc1, '1'))).toBeTruthy()
      expect(first.externalRecordsByRef?.get(key(doc1, '2'))).toBeNull()

      vi.mocked(hydrator.label.getLabelsForSubjects).mockClear()
      const again = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(doc1, '2'), v(doc1, '1'), v(doc1, '2')],
        ctx,
        { seenRecordKeys: seen },
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
        { seenRecordKeys: seen },
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
        { seenRecordKeys: seen },
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
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, {
        seenRecordKeys: seen,
      })
      expect(seen.has(fetchedKey(doc1))).toBe(false)
      const latestAfterRoot = latestLookups()
      expect(latestAfterRoot).toContain(doc1)
      for (const ref of [fetched, v(doc1, '1'), v(doc1, '2')]) {
        const state = await hydrator.hydrateEmbedExternalViewFromRefs(
          [ref],
          ctx,
          { seenRecordKeys: seen },
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
      await hydrator.hydrateEmbedExternalViewFromRefs([v(doc1, '2')], ctx, {
        seenRecordKeys: reversed,
      })
      await hydrator.hydrateEmbedExternalViewFromRefs([v(doc1, '1')], ctx, {
        seenRecordKeys: reversed,
      })
      expect(latestLookups()).toEqual([])
      const latest = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1],
        ctx,
        { seenRecordKeys: reversed },
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
        { seenRecordKeys: seen },
      )
      // A later latest lookup of the same URI is new work; its dependencies
      // are already seen.
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, {
        seenRecordKeys: seen,
      })

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

    it('counts an exact root batch toward the pass limit', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      using _refs = mockRefs(
        fixture,
        new Map([[key(pathUri(0), '1'), { body: makeDoc(pathUri(1)) }]]),
      )
      using warn = vi.spyOn(hydrationLogger, 'warn')
      const state = await hydrator.hydrateEmbedExternalViewFromRefs(
        [v(pathUri(0), '1')],
        ctx,
        { hydrationPass: max },
      )
      expect(labelSubjects(fixture)).toHaveLength(1)
      expect(state.externalRecordsByRef?.get(key(pathUri(0), '1'))).toBeTruthy()
      expect(state.externalRecords?.has(pathUri(1))).toBeFalsy()
      expect(warn).toHaveBeenCalledTimes(1)
    })

    describe('post associations', () => {
      const author = 'did:plc:author' as DidString
      const postUri = (rkey: string) =>
        atUri(author, app.bsky.feed.post.$type, rkey)
      const thingUri = atUri(author, 'app.example.thing' as never, '1')
      const feedUri = postUri('feed')
      const rootUri = postUri('root')
      const quotedUri = postUri('quoted')
      const postCid = (uri: AtUriString) => `post-${uri}`
      const external = (...refs: { uri: AtUriString; cid: string }[]) =>
        app.bsky.embed.external.main.$build({
          external: {
            uri: 'https://example.com/post' as never,
            title: 'Card',
            description: '',
            associatedRefs: refs,
          },
        })
      const makePost = (
        uri: AtUriString,
        embed?: app.bsky.feed.post.Main['embed'],
        reply?: { root: AtUriString; parent: AtUriString },
      ): [AtUriString, Post] => [
        uri,
        {
          record: app.bsky.feed.post.$build({
            text: 'post',
            createdAt: '2026-10-01T00:00:00.000Z',
            embed,
            reply: reply && {
              root: { uri: reply.root, cid: postCid(reply.root) },
              parent: { uri: reply.parent, cid: postCid(reply.parent) },
            },
          }),
          cid: postCid(uri),
          sortedAt: new Date(0),
          indexedAt: new Date(0),
          takedownRef: undefined,
          violatesThreadGate: false,
          violatesEmbeddingRules: false,
          hasThreadGate: false,
          hasPostGate: false,
          tags: new Set(),
        },
      ]

      // Real `hydratePosts` over deterministic posts; only unrelated feed
      // plumbing is empty.
      const setup = (fixture: Fixture, posts: [AtUriString, Post][]) => {
        const { hydrator } = fixture
        const byUri = new Map(posts)
        vi.spyOn(hydrator.feed, 'getPosts').mockImplementation(
          async (uris) =>
            new HydrationMap(uris.map((uri) => [uri, byUri.get(uri) ?? null])),
        )
        vi.spyOn(hydrator.feed, 'getThreadgatesForPosts').mockResolvedValue(
          new HydrationMap(),
        )
        vi.spyOn(hydrator.feed, 'getPostAggregates').mockResolvedValue(
          new HydrationMap(),
        )
        vi.spyOn(hydrator.feed, 'getPostgatesForPosts').mockResolvedValue(
          new HydrationMap(),
        )
        vi.spyOn(hydrator, 'hydrateBidirectionalBlocks').mockResolvedValue(
          new HydrationMap(),
        )
        vi.spyOn(hydrator, 'hydrateProfiles').mockResolvedValue({})
        vi.spyOn(hydrator, 'hydrateLists').mockResolvedValue({})
        vi.spyOn(hydrator, 'hydrateFeedGens').mockResolvedValue({})
        vi.spyOn(hydrator, 'hydrateLabelers').mockResolvedValue({})
        vi.spyOn(hydrator, 'hydrateStarterPacksBasic').mockResolvedValue({})
      }

      it('shares URI subscription outcomes with pinned post roots without treating discarded refs as targets', async ({
        fixture,
      }) => {
        const { hydrator, ctx, records, dataplane, seedBasic } = fixture
        seedBasic()
        records.set(pub2Uri, { body: makePub() })
        using _refs = mockRefs(
          fixture,
          new Map([
            [key(doc1, '1'), { body: makeDoc(pubUri) }],
            [key(doc2, '1'), { body: makeDoc(pub2Uri) }],
            [key(missingPubDoc, '1'), { body: makeDoc(missingPub) }],
          ]),
        )
        setup(fixture, [
          makePost(feedUri, external(v(doc1, '1'), v(missingPubDoc, '1'))),
          makePost(rootUri, external(v(doc2, '1'))),
        ])
        using _viewers = vi
          .spyOn(hydrator.feed, 'getPostViewerStates')
          .mockResolvedValue(new HydrationMap())
        const viewer: DidString = 'did:plc:viewer'
        using byActor = vi
          .spyOn(dataplane, 'getAtmosphereBacklinksByActor')
          .mockImplementation(
            async ({ targetUris = [] }) =>
              new GetAtmosphereBacklinksByActorResponse({
                results: targetUris.map((targetUri) => ({
                  targetUri,
                  uris: [subscriptionUri(viewer, '1')],
                })),
              }),
          )
        const subscriptions: ExternalPublicationSubscriptions =
          new HydrationMap()
        const seenRecordKeys = new Set<string>()
        const scopedCtx = ctx.copy({ viewer })
        const uriState = await hydrator.hydrateEmbedExternalViewFromUris(
          [doc1],
          scopedCtx,
          {
            hydration: 'basic',
            seenRecordKeys,
            publicationSubscriptions: subscriptions,
          },
        )
        const postState = await hydrator.hydratePosts(
          [{ uri: feedUri }, { uri: rootUri }],
          scopedCtx,
          uriState,
          {
            externalSeenRecordKeys: seenRecordKeys,
            externalPublicationSubscriptions: subscriptions,
          },
        )
        const state = mergeStates(uriState, postState)

        expect(state.externalPublicationSubscriptions).toBe(subscriptions)
        expect([...subscriptions]).toEqual([
          [pubUri, true],
          [pub2Uri, true],
        ])
        expect(byActor.mock.calls.map(([req]) => req.targetUris)).toEqual([
          [pubUri],
          [pub2Uri],
        ])
        expect(state.externalRecordsByRef?.get(key(doc1, '1'))?.record).toEqual(
          makeDoc(pubUri),
        )
        expect(state.externalRecordsByRef?.get(key(doc2, '1'))?.record).toEqual(
          makeDoc(pub2Uri),
        )
        expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
      })

      it('hydrates one root per post through one basic exact-root traversal', async ({
        fixture,
      }) => {
        const { hydrator, ctx, dataplane, seedBasic } = fixture
        const { recs, subs } = seedBasic()
        const thing = { $type: 'app.example.thing', n: 1 }
        const versions = new Map<string, { body: object }>([
          [key(doc1, '1'), { body: makeDoc(pubUri) }],
          [key(doc1, '2'), { body: makeDoc(pub2Uri) }],
          [key(doc2, '1'), { body: makeDoc(pubUri) }],
          [key(pubUri, '1'), { body: makePub() }],
          [key(thingUri, '1'), { body: thing }],
        ])
        fixture.records.set(pub2Uri, { body: makePub() })
        using _refs = mockRefs(fixture, versions)
        setup(fixture, [
          // Direct embed, with a duplicate and a non-Standard.site root.
          makePost(
            feedUri,
            external(
              v(doc1, '1'),
              v(pubUri, '1'),
              v(thingUri, '1'),
              v(doc1, '1'),
            ),
            { root: rootUri, parent: rootUri },
          ),
          // Reply root: a quote with an external media association.
          makePost(
            rootUri,
            app.bsky.embed.recordWithMedia.main.$build({
              record: app.bsky.embed.record.main.$build({
                record: { uri: quotedUri, cid: postCid(quotedUri) },
              }),
              media: external(v(pubUri, '1'), v(doc1, '2')),
            }),
          ),
          // Quoted post, only reachable through the second layer.
          makePost(quotedUri, external(v(doc2, '1'))),
        ])

        const state = await hydrator.hydrateFeedItems(
          [{ post: { uri: feedUri, cid: postCid(feedUri) } }],
          ctx.copy({ xrpcEndpoint: app.bsky.feed.getFeed.$lxm }),
        )

        // One exact-root fetch for every distinct pin, in encounter order.
        expect(dataplane.getRecordsByRef).toHaveBeenCalledTimes(1)
        expect(
          vi
            .mocked(dataplane.getRecordsByRef)
            .mock.calls[0][0].refs?.map(({ uri, cid }) => `${uri}@${cid}`),
        ).toEqual([key(doc1, '1'), key(doc1, '2'), key(doc2, '1')])
        expect(fullTraversalReports()).toHaveLength(1)
        expect(fullTraversalReports()).toMatchObject([
          {
            root: 'refs',
            outcome: 'completed',
            xrpcEndpoint: app.bsky.feed.getFeed.$lxm,
          },
        ])

        // Discarded authored refs do not become roots.
        expect(state.externalRecordsByRef?.has(key(thingUri, '1'))).toBe(false)
        expect(state.externalRecords?.has(thingUri)).toBe(false)
        expect(state.externalRecords?.get(pubUri)).toBeTruthy()
        expect(state.externalRecords?.get(pub2Uri)).toBeTruthy()
        // Basic keeps aggregate counts (for every collection's targets) but
        // schedules no social-preview samples, records or participants.
        expect(state.externalRecordBacklinkCounts?.get(doc1)).toEqual({
          [site.standard.graph.recommend.$type]: 42,
        })
        expect(state.externalRecordBacklinkCounts?.get(pubUri)).toEqual({
          [site.standard.graph.subscription.$type]: 17,
        })
        expect(dataplane.getAtmosphereBacklinks).not.toHaveBeenCalled()
        expect(state.externalRecordBacklinks?.get(doc1)).toBeUndefined()
        expect(state.externalRecordBacklinks?.get(pubUri)).toBeUndefined()
        const participantUris = [...recs, ...subs]
        const participants: string[] = participantUris
        for (const uri of participantUris) {
          expect(state.externalRecords?.has(uri)).toBeFalsy()
        }
        expect(
          labelSubjects(fixture)
            .flat()
            .filter((uri) => participants.includes(uri)),
        ).toEqual([])
        expect(
          vi
            .mocked(hydrator.hydrateProfilesBasic)
            .mock.calls.flatMap(([dids]) => dids)
            .filter((did) => /^did:plc:(?:[a-e]|s\d)$/.test(did)),
        ).toEqual([])
        expect(state.labels?.has(doc1)).toBe(true)
        expect(state.actors?.has(author)).toBe(true)
        expect(state.actors?.has('did:plc:pub' as DidString)).toBe(true)

        // Exact pins stay distinct.
        expect(
          (
            state.externalRecordsByRef?.get(key(doc1, '2'))
              ?.record as never as {
              site: string
            }
          ).site,
        ).toBe(pub2Uri)

        // The ordinary post label/profile batches exclude external additions
        // (those are fetched by the generic traversal's own passes).
        const postUris = [feedUri, rootUri, quotedUri].toSorted()
        const ordinaryLabels = labelSubjects(fixture).filter((subjects) =>
          subjects.includes(feedUri),
        )
        expect(ordinaryLabels).toHaveLength(1)
        expect([...ordinaryLabels[0]].toSorted()).toEqual(postUris)
        expect(
          vi
            .mocked(hydrator.hydrateProfiles)
            .mock.calls.flatMap(([dids]) => dids),
        ).toEqual([author])

        // Post state is preserved.
        expect([...(state.posts?.keys() ?? [])].toSorted()).toEqual(
          [feedUri, rootUri, quotedUri].toSorted(),
        )
      })

      it('hydrates only one gallery from 200 authored refs, with bounded items and photos', async ({
        fixture,
      }) => {
        const { hydrator, ctx, records, backlinks, counts, dataplane } = fixture
        const createdAt = '2026-10-01T00:00:00.000Z'
        const galleries = Array.from({ length: 200 }, (_, i) =>
          atUri('did:plc:grain', social.grain.gallery.$type, String(i)),
        )
        const gallery = galleries[0]
        const items = Array.from({ length: 12 }, (_, i) =>
          atUri('did:plc:grain', social.grain.gallery.item.$type, String(i)),
        )
        const photos = items.map((_, i) =>
          atUri('did:plc:photo', social.grain.photo.$type, String(i)),
        )
        items.forEach((uri, i) => {
          records.set(uri, {
            body: social.grain.gallery.item.$build({
              gallery,
              item: photos[i],
              createdAt,
            }),
          })
          records.set(photos[i], { body: { $type: social.grain.photo.$type } })
        })
        backlinks.set(gallery, items)
        counts.set(gallery, { [social.grain.favorite.$type]: 99n })
        using _refs = mockRefs(
          fixture,
          new Map([
            [
              key(gallery, '1'),
              {
                body: social.grain.gallery.$build({
                  title: 'Photos',
                  createdAt,
                }),
              },
            ],
          ]),
        )
        setup(fixture, [
          makePost(feedUri, external(...galleries.map((uri) => v(uri, '1')))),
        ])
        const state = await hydrator.hydratePosts([{ uri: feedUri }], ctx)
        expect(
          vi
            .mocked(dataplane.getRecordsByRef)
            .mock.calls.flatMap(([req]) => req.refs ?? []),
        ).toEqual([v(gallery, '1')])
        expect(
          vi
            .mocked(dataplane.getRecordsByURI)
            .mock.calls.flatMap(([req]) => req.uris ?? []),
        ).toEqual([...items.slice(0, 10), ...photos.slice(0, 10)])
        expect(dataplane.getAtmosphereBacklinks).toHaveBeenCalledTimes(1)
        expect(state.externalRecordBacklinkCounts?.get(gallery)).toEqual({
          [social.grain.favorite.$type]: 99,
        })
        expect(traversalReports()).toMatchObject([{ recordLookups: 21 }])
      })

      it('does no external work without valid associations', async ({
        fixture,
      }) => {
        const { hydrator, ctx, dataplane } = fixture
        const handleDoc = `at://example.com/${site.standard.document.$type}/1`
        const refs = [
          { uri: handleDoc as AtUriString, cid: 'v1' },
          { uri: doc1, cid: '' },
          { uri: `${doc1}#frag` as AtUriString, cid: 'v1' },
          {
            uri: `at://did:plc:author/${site.standard.document.$type}` as never,
            cid: 'v1',
          },
        ]
        setup(fixture, [
          makePost(feedUri, external(...refs)),
          makePost(rootUri),
        ])
        using byRef = vi.spyOn(dataplane, 'getRecordsByRef')

        const state = await hydrator.hydratePosts(
          [{ uri: feedUri }, { uri: rootUri }],
          ctx,
        )

        expect(byRef).not.toHaveBeenCalled()
        expect(dataplane.getRecordsByURI).not.toHaveBeenCalled()
        expect(traversalReports()).toEqual([])
        expect(state.externalRecordsByRef).toBeUndefined()
        expect(state.posts?.has(feedUri)).toBe(true)
      })

      it('nulls moderated roots without touching ordinary post state', async ({
        fixture,
      }) => {
        const { hydrator, ctx, takedownLabeled, seedBasic } = fixture
        seedBasic()
        takedownLabeled.add(doc1)
        using _refs = mockRefs(
          fixture,
          new Map([
            [key(doc1, '1'), { body: makeDoc(pubUri) }],
            [key(pubUri, '1'), { body: makePub() }],
          ]),
        )
        setup(fixture, [
          makePost(feedUri, external(v(doc1, '1'), v(pubUri, '1'))),
        ])

        const state = await hydrator.hydratePosts([{ uri: feedUri }], ctx)

        expect(state.externalRecordsByRef?.get(key(doc1, '1'))).toBeNull()
        expect(state.externalRecordsByRef?.has(key(pubUri, '1'))).toBe(false)
        expect(state.externalRecords?.has(pubUri)).toBeFalsy()
        expect(state.posts?.get(feedUri)).toBeTruthy()
      })

      it('fails on root failures but tolerates dependency failures', async ({
        fixture,
      }) => {
        const { hydrator, ctx, dataplane, seedBasic } = fixture
        seedBasic()
        using _refs = mockRefs(
          fixture,
          new Map([[key(doc1, '1'), { body: makeDoc(pubUri) }]]),
        )
        setup(fixture, [makePost(feedUri, external(v(doc1, '1')))])
        using warn = vi
          .spyOn(hydrationLogger, 'warn')
          .mockImplementation(() => {})

        failRecordBatches(fixture, (uri) => uri === pubUri, new Error('deps'))
        const state = await hydrator.hydratePosts([{ uri: feedUri }], ctx)
        expect(state.externalRecordsByRef?.get(key(doc1, '1'))).toBeTruthy()
        expect(state.externalRecords?.has(pubUri)).toBeFalsy()
        expect(warn).toHaveBeenCalled()

        vi.mocked(dataplane.getRecordsByRef).mockRejectedValue(
          new Error('root'),
        )
        await expect(
          hydrator.hydratePosts([{ uri: feedUri }], ctx),
        ).rejects.toThrow('root')
      })
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
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx, {
        seenRecordKeys: seen,
      })
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx, {
        seenRecordKeys: seen,
      })
      expect(traversalReports().map((r) => r.recordLookups)).toEqual([1, 1])

      vi.mocked(events.externalHydrationTraversal).mockClear()
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, doc2], ctx, {
        seenRecordKeys: seen,
      })
      await hydrator.hydrateEmbedExternalViewFromUris([], ctx)
      await hydrator.hydrateEmbedExternalViewFromRefs([], ctx)
      await hydrator.hydrateExternalViewDependencies({ ctx }, [], ctx)
      expect(events.externalHydrationTraversal).not.toHaveBeenCalled()
    })

    it('reports a capped traversal without the skipped lookups', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      using warn = vi.spyOn(hydrationLogger, 'warn')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [pathUri(0)],
        ctx,
        { hydrationPass: max - 1 },
      )
      expect(state.externalRecords?.has(pathUri(1))).toBe(true)
      expect(state.externalRecords?.has(pathUri(2))).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
      const prehydrated = async () => ({
        ctx,
        externalRecords: await hydrator.external.getRecordsByURI([pathUri(0)]),
      })
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: pathUri(0) }],
        ctx,
        { hydrationPass: max - 1 },
      )
      await hydrator.hydrateExternalViewDependencies(
        await prehydrated(),
        [{ uri: pathUri(0) }],
        ctx,
        { hydrationPass: max },
      )
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'capped',
          recordLookups: 2,
          batches: 2,
          maxPass: max,
        },
        {
          root: 'dependencies',
          outcome: 'capped',
          recordLookups: 1,
          batches: 1,
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

    it('reports attempted work once and keeps partial state when a nested fetch fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      seedPath(fixture, 5)
      failRecordBatches(
        fixture,
        (uri) => uri === pathUri(2),
        new Error('dataplane failure'),
      )
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})

      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [pathUri(0)],
        ctx,
      )
      expect(state.externalRecords?.get(pathUri(0))).toBeTruthy()
      expect(state.externalRecords?.get(pathUri(1))).toBeTruthy()
      expect(state.externalRecords?.has(pathUri(2))).toBe(false)
      expect(state.externalRecordBacklinks?.get(pathUri(1))).toEqual([
        pathUri(2),
      ])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'partial',
          recordLookups: 3,
          batches: 3,
          maxPass: 3,
        },
      ])
    })

    it('reports attempted work once when the root fetch fails and rethrows', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      seedPath(fixture, 5)
      const err = new Error('dataplane failure')
      failRecordBatches(fixture, (uri) => uri === pathUri(0), err)

      await expect(
        hydrator.hydrateEmbedExternalViewFromUris([pathUri(0)], ctx),
      ).rejects.toBe(err)
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'failed',
          recordLookups: 1,
          batches: 1,
          maxPass: 1,
        },
      ])
    })

    it('fails the traversal when a later root request fails', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      seedPath(fixture, 101)
      const roots = Array.from({ length: 101 }, (_, i) => pathUri(i))
      const err = new Error('dataplane failure')
      failRecordBatches(fixture, (uri) => uri === pathUri(100), err)

      await expect(
        hydrator.hydrateEmbedExternalViewFromUris(roots, ctx),
      ).rejects.toBe(err)
      expect(dataplane.getRecordsByURI).toHaveBeenCalledTimes(2)
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'failed',
          recordLookups: 101,
          batches: 1,
          maxPass: 1,
        },
      ])
    })

    it('reports successful empty pages and unavailable records as completed', async ({
      fixture,
    }) => {
      const { hydrator, ctx, records } = fixture
      records.set(doc1, { body: makeDoc(missingPub) })
      using warn = vi.spyOn(hydrationLogger, 'warn')
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [doc1, missingDoc],
        ctx,
      )

      expect(state.externalRecordBacklinks?.get(doc1)).toEqual([])
      expect(state.externalRecords?.get(missingDoc)).toBeNull()
      expect(state.externalRecords?.get(missingPub)).toBeNull()
      expect(warn).not.toHaveBeenCalled()
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'completed',
          recordLookups: 3,
          batches: 2,
          maxPass: 2,
        },
      ])
    })

    it('reports a capped traversal as capped despite recovered failures', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const max = MAX_EXTERNAL_HYDRATION_PASSES
      seedPath(fixture, 3)
      vi.mocked(dataplane.getAtmosphereBacklinkCounts).mockRejectedValue(
        new Error('counts failure'),
      )
      using warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      await hydrator.hydrateEmbedExternalViewFromUris([pathUri(0)], ctx, {
        hydrationPass: max - 1,
      })
      // Both count targets fail, then the publication's subscription is capped.
      expect(warn).toHaveBeenCalledTimes(3)
      expect(traversalReports()).toEqual([
        {
          root: 'uris',
          outcome: 'capped',
          recordLookups: 2,
          batches: 2,
          maxPass: max,
        },
      ])
    })
  })
  describe('traversal health telemetry', () => {
    const counts = ({
      roots,
      rootsResolved,
      dependencies,
      dependenciesResolved,
    }: ReturnType<typeof fullTraversalReports>[number]) => ({
      roots,
      rootsResolved,
      dependencies,
      dependenciesResolved,
    })
    // doc1 links its publication and one recommendation; the publication has
    // one subscription.
    const seedLinkedDoc = ({ records, backlinks }: Fixture) => {
      const rec = recommendUri('did:plc:a', '1')
      const sub = subscriptionUri('did:plc:s1', '1')
      records.set(doc1, { body: makeDoc(pubUri) })
      records.set(pubUri, { body: makePub() })
      records.set(rec, { body: makeRecommend(doc1) })
      records.set(sub, { body: makeSubscription(pubUri) })
      backlinks.set(doc1, [rec])
      backlinks.set(pubUri, [sub])
      return { rec, sub }
    }

    it('reports the context XRPC endpoint from every entry point, or unknown, with a duration', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records } = fixture
      records.set(doc1, { body: makeDoc(pubUri) })
      records.set(pubUri, { body: makePub() })
      using _refs = vi
        .spyOn(dataplane, 'getRecordsByRef')
        .mockResolvedValue(new GetRecordsByRefResponse())
      const xrpcEndpoint = app.bsky.unspecced.getAtmosphereExploreTab.$lxm
      const scoped = ctx.copy({ xrpcEndpoint })
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], scoped)
      await hydrator.hydrateEmbedExternalViewFromRefs(
        [{ uri: doc1, cid: 'v1' }],
        scoped,
      )
      await hydrator.hydrateExternalViewDependencies(
        {
          ctx: scoped,
          externalRecords: await hydrator.external.getRecordsByURI([doc1]),
        },
        [{ uri: doc1 }],
        scoped,
      )
      await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      const reports = fullTraversalReports()
      expect(
        reports.map(({ root, xrpcEndpoint }) => ({ root, xrpcEndpoint })),
      ).toEqual([
        { root: 'uris', xrpcEndpoint },
        { root: 'refs', xrpcEndpoint },
        { root: 'dependencies', xrpcEndpoint },
        { root: 'uris', xrpcEndpoint: 'unknown' },
      ])
      for (const { durationMs } of reports) {
        expect(durationMs).toBeGreaterThanOrEqual(0)
      }
    })

    it('counts roots and fetched dependencies by availability', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      seedLinkedDoc(fixture)
      await hydrator.hydrateEmbedExternalViewFromUris([doc1, missingDoc], ctx)

      // Pass 2 fetches the publication and recommendation, pass 3 the
      // subscription.
      const [report] = fullTraversalReports()
      expect(report).toMatchObject({ outcome: 'completed', recordLookups: 5 })
      expect(counts(report)).toEqual({
        roots: 2,
        rootsResolved: 1,
        dependencies: 3,
        dependenciesResolved: 3,
      })
    })

    it('counts a takedown-hidden dependency as unresolved', async ({
      fixture,
    }) => {
      const { hydrator, ctx, takedownLabeled } = fixture
      seedLinkedDoc(fixture)
      takedownLabeled.add(pubUri)
      const state = await hydrator.hydrateEmbedExternalViewFromUris([doc1], ctx)

      // The hidden publication is not expanded to its subscription.
      expect(state.externalRecords?.get(pubUri)).toBeNull()
      expect(counts(fullTraversalReports()[0])).toEqual({
        roots: 1,
        rootsResolved: 1,
        dependencies: 2,
        dependenciesResolved: 1,
      })
    })

    it('excludes refs of a failed nested batch from dependencies', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      seedPath(fixture, 5)
      failRecordBatches(
        fixture,
        (uri) => uri === pathUri(2),
        new Error('dataplane failure'),
      )
      using _warn = vi
        .spyOn(hydrationLogger, 'warn')
        .mockImplementation(() => {})
      await hydrator.hydrateEmbedExternalViewFromUris([pathUri(0)], ctx)

      const [report] = fullTraversalReports()
      expect(report).toMatchObject({ outcome: 'partial', recordLookups: 3 })
      expect(counts(report)).toEqual({
        roots: 1,
        rootsResolved: 1,
        dependencies: 1,
        dependenciesResolved: 1,
      })
    })

    it('reports no roots when the root batch fails', async ({ fixture }) => {
      const { hydrator, ctx } = fixture
      seedPath(fixture, 5)
      const err = new Error('dataplane failure')
      failRecordBatches(fixture, (uri) => uri === pathUri(0), err)
      await expect(
        hydrator.hydrateEmbedExternalViewFromUris([pathUri(0)], ctx),
      ).rejects.toBe(err)

      const [report] = fullTraversalReports()
      expect(report).toMatchObject({ outcome: 'failed', recordLookups: 1 })
      expect(counts(report)).toEqual({
        roots: 0,
        rootsResolved: 0,
        dependencies: 0,
        dependenciesResolved: 0,
      })
    })

    it('counts direct dependency calls at a later pass from their own roots', async ({
      fixture,
    }) => {
      const { hydrator, ctx } = fixture
      seedPath(fixture, 5)
      await hydrator.hydrateExternalViewDependencies(
        {
          ctx,
          externalRecords: await hydrator.external.getRecordsByURI([
            pathUri(0),
          ]),
        },
        [{ uri: pathUri(0) }],
        ctx,
        {
          seenRecordKeys: new Set(),
          hydrationPass: 3,
        },
      )

      const [report] = fullTraversalReports()
      expect(report).toMatchObject({
        root: 'dependencies',
        batches: 2,
        maxPass: 5,
      })
      expect(counts(report)).toEqual({
        roots: 1,
        rootsResolved: 1,
        dependencies: 2,
        dependenciesResolved: 2,
      })
    })

    it('reports prehydrated roots that schedule no fetch batches', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane, records } = fixture
      records.set(doc1, { body: makeDoc('https://example.com') })
      const externalRecords = await hydrator.external.getRecordsByURI([doc1])
      vi.mocked(dataplane.getRecordsByURI).mockClear()
      vi.mocked(dataplane.getAtmosphereBacklinks).mockClear()
      vi.mocked(dataplane.getAtmosphereBacklinkCounts).mockClear()

      await hydrator.hydrateExternalViewDependencies(
        { ctx, externalRecords },
        [{ uri: doc1 }],
        ctx,
      )

      expect(dataplane.getAtmosphereBacklinks).toHaveBeenCalled()
      expect(dataplane.getAtmosphereBacklinkCounts).toHaveBeenCalled()
      expect(dataplane.getRecordsByURI).not.toHaveBeenCalled()
      const reports = fullTraversalReports()
      expect(reports).toHaveLength(1)
      expect(reports[0]).toMatchObject({
        root: 'dependencies',
        outcome: 'completed',
        recordLookups: 0,
        batches: 0,
        maxPass: 0,
      })
      expect(counts(reports[0])).toEqual({
        roots: 1,
        rootsResolved: 1,
        dependencies: 0,
        dependenciesResolved: 0,
      })
    })

    it('reports an unavailable prehydrated root without gating on resolved roots', async ({
      fixture,
    }) => {
      const { hydrator, ctx, dataplane } = fixture
      const externalRecords = await hydrator.external.getRecordsByURI([
        missingDoc,
      ])
      expect(externalRecords.get(missingDoc)).toBeNull()
      vi.mocked(dataplane.getRecordsByURI).mockClear()

      await hydrator.hydrateExternalViewDependencies(
        { ctx, externalRecords },
        [{ uri: missingDoc }],
        ctx,
      )

      expect(dataplane.getRecordsByURI).not.toHaveBeenCalled()
      const reports = fullTraversalReports()
      expect(reports).toHaveLength(1)
      expect(reports[0]).toMatchObject({
        root: 'dependencies',
        outcome: 'completed',
        recordLookups: 0,
        batches: 0,
        maxPass: 0,
      })
      expect(counts(reports[0])).toEqual({
        roots: 1,
        rootsResolved: 0,
        dependencies: 0,
        dependenciesResolved: 0,
      })
    })
  })
})

describe('Hydrator.hydrateProfilesDetailed profile links', () => {
  const did = 'did:plc:linky' as DidString
  const takenDownUri = atUri(did, app.bsky.actor.link.$type, 'down')
  const keptUri = atUri(did, app.bsky.actor.link.$type, 'kept')
  const createdAt = '2026-10-01T00:00:00.000Z'
  const labelerDid = 'did:plc:labeler' as DidString

  const makeLabels = (
    subjects: Record<AtUriString, { val: string; isTakendown?: boolean }>,
  ) => {
    const labels = new Labels()
    for (const [uri, { val, isTakendown = false }] of Object.entries(
      subjects,
    ) as [AtUriString, { val: string; isTakendown?: boolean }][]) {
      const label: Label = { src: labelerDid, uri, val, cts: createdAt }
      labels.set(uri, {
        isImpersonation: false,
        isTakendown,
        needsReview: false,
        labels: new HydrationMap([[Labels.key(label), label]]),
      })
    }
    return labels
  }

  const createLinkFixture = (
    labelsBySubject: Record<
      AtUriString,
      { val: string; isTakendown?: boolean }
    >,
  ) => {
    const dataplane = createPromiseClient(
      Service,
      createRouterTransport(() => {}),
    )
    const hydrator = new Hydrator(dataplane, [], {} as HydratorConfig)
    const ctx = new HydrateCtx({
      labelers: { dids: [labelerDid], redact: new Set() },
      viewer: null,
      features: {} as never,
    })
    // Fresh maps on each call: hydration merges and nulls entries in place.
    const spies = [
      vi.spyOn(hydrator.actor, 'getActors').mockImplementation(
        async (dids) =>
          new HydrationMap(
            dids.map((d) => [
              d,
              {
                did: d,
                handle: 'linky.test',
                isLabeler: false,
                verifications: [],
                allowActivitySubscriptionsFrom: 'none',
                accountModerationTags: new Set(),
                profileModerationTags: new Set(),
                profile: app.bsky.actor.profile.$build({
                  links: [takenDownUri, keptUri].map((uri) => ({
                    uri,
                    cid: 'bafyreid6c2mfvztew4wrg7ld3m4o4ssbxz4miklv7u46mko3sjqdvaxzfa',
                  })),
                }),
              },
            ]),
          ) as unknown as Actors,
      ),
      vi
        .spyOn(hydrator.actor, 'getProfileAggregates')
        .mockImplementation(async () => new HydrationMap()),
      vi.spyOn(hydrator.actor, 'getProfileLinks').mockImplementation(
        async (uris) =>
          new HydrationMap(
            uris.map((uri) => [
              uri,
              {
                record: app.bsky.actor.link.$build({
                  url: 'https://example.com',
                  createdAt,
                }),
                cid: `cid-${uri}`,
                sortedAt: new Date(createdAt),
                indexedAt: new Date(createdAt),
                takedownRef: undefined,
              },
            ]),
          ) as ProfileLinks,
      ),
      vi.spyOn(hydrator, 'hydrateStarterPacksBasic').mockResolvedValue({}),
      vi
        .spyOn(hydrator.label, 'getLabelsForSubjects')
        .mockImplementation(async (subjects) => {
          const wanted = Object.fromEntries(
            Object.entries(labelsBySubject).filter(([uri]) =>
              subjects.includes(uri as AtUriString),
            ),
          )
          return makeLabels(wanted)
        }),
    ]
    return {
      hydrator,
      ctx,
      [Symbol.dispose]: () => spies.forEach((spy) => spy.mockRestore()),
    }
  }

  const profileUri = atUri(did, app.bsky.actor.profile.$type, 'self')

  it('nulls only the link with an actionable takedown label', async () => {
    using fixture = createLinkFixture({
      [takenDownUri]: { val: '!takedown', isTakendown: true },
      [keptUri]: { val: 'spam' },
      [profileUri]: { val: 'profile-label' },
    })
    const { hydrator, ctx } = fixture
    const state = await hydrator.hydrateProfilesDetailed([did], ctx)

    expect(state.profileLinks?.get(takenDownUri)).toBeNull()
    expect(state.profileLinks?.get(keptUri)).toBeTruthy()
    expect(state.actors?.get(did)).toBeTruthy()
    expect(state.labels?.getBySubject(takenDownUri).map((l) => l.val)).toEqual([
      '!takedown',
    ])
    expect(state.labels?.getBySubject(keptUri).map((l) => l.val)).toEqual([
      'spam',
    ])
    expect(state.labels?.getBySubject(profileUri).map((l) => l.val)).toEqual([
      'profile-label',
    ])
  })

  it('keeps links whose labels are not actionable takedowns', async () => {
    using fixture = createLinkFixture({
      [takenDownUri]: { val: 'spam', isTakendown: false },
    })
    const { hydrator, ctx } = fixture
    const state = await hydrator.hydrateProfilesDetailed([did], ctx)

    expect(state.profileLinks?.get(takenDownUri)).toBeTruthy()
    expect(state.profileLinks?.get(keptUri)).toBeTruthy()
  })

  it('keeps taken-down links when includeTakedowns is set', async () => {
    using fixture = createLinkFixture({
      [takenDownUri]: { val: '!takedown', isTakendown: true },
    })
    const { hydrator, ctx } = fixture
    const state = await hydrator.hydrateProfilesDetailed(
      [did],
      ctx.copy({ includeTakedowns: true }),
    )

    expect(state.profileLinks?.get(takenDownUri)).toBeTruthy()
    expect(state.labels?.getBySubject(takenDownUri)).toHaveLength(1)
  })

  it('does not hydrate links or link labels for basic profiles', async () => {
    using fixture = createLinkFixture({
      [takenDownUri]: { val: '!takedown', isTakendown: true },
    })
    const { hydrator, ctx } = fixture
    const state = await hydrator.hydrateProfilesBasic([did], ctx)

    expect(state.profileLinks).toBeUndefined()
    expect(state.labels?.get(takenDownUri)).toBeUndefined()
    expect(hydrator.actor.getProfileLinks).not.toHaveBeenCalled()
  })

  it('handles profiles without links', async () => {
    using fixture = createLinkFixture({})
    const { hydrator, ctx } = fixture
    vi.mocked(hydrator.actor.getActors).mockImplementation(
      async (dids) =>
        new HydrationMap(
          dids.map((d) => [d, { did: d, verifications: [] }]),
        ) as unknown as Actors,
    )
    const state = await hydrator.hydrateProfilesDetailed([did], ctx)

    expect(state.actors?.get(did)).toBeTruthy()
    expect(state.profileLinks?.size ?? 0).toBe(0)
  })
})
