import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { assert, describe, expect, it as baseIt, vi } from 'vitest'
import type { TypedLexMap } from '@atproto/lex-data'
import { type AtUriString, type DidString, atUri } from '@atproto/lex-schema'
import { ImageUriBuilder } from '../image/uri.js'
import { app, site, social } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import { events } from '../telemetry/events.js'
import { Views } from '../views/index.js'
import { VideoUriBuilder } from '../views/util.js'
import type { Actors } from './actor.js'
import {
  type ExternalKnownInteractors,
  type ExternalRecord,
  type ExternalRecords,
  genericRecordKey,
} from './external.js'
import {
  type BidirectionalBlocks,
  HydrateCtx,
  type HydrationState,
  Hydrator,
  type HydratorConfig,
} from './hydrator.js'
import { Labels } from './label.js'
import { HydrationMap } from './util.js'

const viewer: DidString = 'did:plc:viewer'
const owner: DidString = 'did:plc:owner'
const newest: DidString = 'did:plc:newest'
const older: DidString = 'did:plc:older'
const oldest: DidString = 'did:plc:oldest'
const document = atUri(owner, site.standard.document.$type, 'document')
const gallery = atUri(owner, social.grain.gallery.$type, 'gallery')
const publication = atUri(owner, site.standard.publication.$type, 'publication')
const cid = 'bafyreid6c2mfvztew4wrg7ld3m4o4ssbxz4miklv7u46mko3sjqdvaxzfa'

const views = new Views({
  imgUriBuilder: new ImageUriBuilder('https://cdn.example.com/img'),
  videoUriBuilder: new VideoUriBuilder({
    playlistUrlPattern: '',
    thumbnailUrlPattern: '',
  }),
  indexedAtEpoch: undefined,
  threadTagsBumpDown: [],
  threadTagsHide: [],
  visibilityTagHide: '',
  visibilityTagRankPrefix: '',
})

function modalityView(uri: AtUriString, state: HydrationState) {
  const view = views.externalRecordView(uri, state, 0)
  assert(view && !app.bsky.embed.external.viewLivestream.$isTypeOf(view))
  return view
}

function record(body: TypedLexMap): ExternalRecord {
  return {
    record: body,
    cid,
    indexedAt: new Date(0),
    sortedAt: new Date(0),
    takedownRef: undefined,
  }
}

const it = baseIt.extend<{
  fixture: {
    hydrator: Hydrator
    ctx: HydrateCtx
    records: ExternalRecords
    known: ExternalKnownInteractors
    actors: Actors
    blocks: BidirectionalBlocks
  }
}>({
  // eslint-disable-next-line no-empty-pattern -- Vitest requires destructured fixture dependencies.
  fixture: async ({}, use) => {
    const hydrator = new Hydrator(
      createPromiseClient(
        Service,
        createRouterTransport(() => {}),
      ),
      [],
      {} as HydratorConfig,
    )
    const ctx = new HydrateCtx({
      viewer,
      labelers: { dids: [], redact: new Set() },
      features: {} as never,
    })
    const records: ExternalRecords = new HydrationMap([
      [
        document,
        record(
          site.standard.document.$build({
            site: publication,
            title: 'Article',
            publishedAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      ],
      [
        gallery,
        record(
          social.grain.gallery.$build({
            title: 'Gallery',
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      ],
      [
        publication,
        record(
          site.standard.publication.$build({
            url: 'https://example.com',
            name: 'Publication',
          }),
        ),
      ],
    ])
    const known: ExternalKnownInteractors = new HydrationMap(
      [document, gallery, publication].map((uri) => [
        uri,
        { count: 8, actors: [newest, older, oldest] },
      ]),
    )
    const actors: Actors = new HydrationMap(
      [owner, viewer, newest, older, oldest].map((did) => [
        did,
        {
          did,
          handle: 'user.example.com',
          isLabeler: false,
          verifications: [],
          allowActivitySubscriptionsFrom: 'none',
          accountModerationTags: new Set<string>(),
          profileModerationTags: new Set<string>(),
        },
      ]),
    )
    const blocks: BidirectionalBlocks = new HydrationMap()
    using _records = vi
      .spyOn(hydrator.external, 'getRecordsByURI')
      .mockImplementation(
        async (uris) =>
          new HydrationMap(uris.map((uri) => [uri, records.get(uri) ?? null])),
      )
    using _known = vi
      .spyOn(hydrator.external, 'getKnownInteractors')
      .mockImplementation(
        async (uris) =>
          new HydrationMap(uris.map((uri) => [uri, known.get(uri) ?? null])),
      )
    using _counts = vi
      .spyOn(hydrator.external, 'getAtmosphereBacklinkCounts')
      .mockImplementation(
        async (uris) => new HydrationMap(uris.map((uri) => [uri, {}])),
      )
    using _backlinks = vi
      .spyOn(hydrator.external, 'getAtmosphereBacklinks')
      .mockResolvedValue({ backlinks: [] })
    using _likes = vi
      .spyOn(hydrator.external, 'getAtmosphereBacklinksByActor')
      .mockImplementation(async (uris) => ({
        backlinks: new HydrationMap(uris.map((uri) => [uri, []])),
        truncated: false,
      }))
    using _labels = vi
      .spyOn(hydrator.label, 'getLabelsForSubjects')
      .mockResolvedValue(new Labels())
    using _profiles = vi
      .spyOn(hydrator, 'hydrateProfilesBasic')
      .mockImplementation(async (dids) => ({
        actors: new HydrationMap(
          dids.map((did) => [did, actors.get(did) ?? null]),
        ),
      }))
    using _blocks = vi
      .spyOn(hydrator, 'hydrateBidirectionalBlocks')
      .mockResolvedValue(blocks)
    await use({ hydrator, ctx, records, known, actors, blocks })
  },
})

describe('external known interactors', () => {
  it.for(['basic', 'detailed'] as const)(
    'is opt-in at %s depth, including nested publications',
    async (hydration, { fixture }) => {
      const { hydrator, ctx } = fixture
      const lookup = vi.mocked(hydrator.external.getKnownInteractors)
      await hydrator.hydrateEmbedExternalViewFromUris(
        [document, gallery],
        ctx,
        { hydration },
      )
      expect(lookup).not.toHaveBeenCalled()

      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [document, gallery],
        ctx,
        { hydration, knownInteractors: true },
      )
      expect(lookup.mock.calls).toEqual([
        [[document], viewer, site.standard.graph.recommend.$type],
        [[gallery], viewer, social.grain.favorite.$type],
        [[publication], viewer, site.standard.graph.subscription.$type],
      ])
      expect(hydrator.hydrateProfilesBasic).toHaveBeenCalledWith(
        [newest, older, oldest],
        ctx,
      )
      expect(hydrator.hydrateBidirectionalBlocks).toHaveBeenCalledWith(
        new Map([[owner, [newest, older, oldest]]]),
        ctx,
      )

      const article = views.externalRecordView(document, state)
      const photos = views.externalRecordView(gallery, state)
      assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
      assert(photos && app.bsky.embed.external.viewGallery.$isTypeOf(photos))
      expect(article.viewer?.knownLikers?.map(({ did }) => did)).toEqual([
        newest,
        older,
        oldest,
      ])
      expect(article.viewer?.knownLikerCount).toBe(8)
      expect(photos.viewer?.knownLikerCount).toBe(8)
      expect(
        article.publisher?.viewer?.knownSubscribers?.map(({ did }) => did),
      ).toEqual([newest, older, oldest])
      expect(article.publisher?.viewer?.knownSubscriberCount).toBe(8)
      expect(article).not.toHaveProperty('likers')
      expect(photos).not.toHaveProperty('likers')
      app.bsky.embed.external.viewArticle.$validate(article)
      app.bsky.embed.external.viewGallery.$validate(photos)
    },
  )

  it('bounds lookup batches across many roots', async ({
    fixture: { hydrator, ctx, records, known },
  }) => {
    const roots = Array.from({ length: 101 }, (_, i) =>
      atUri(owner, site.standard.document.$type, `document-${i}`),
    )
    for (const uri of roots) {
      records.set(uri, records.get(document)!)
      known.set(uri, { count: 0, actors: [] })
    }
    const state = await hydrator.hydrateEmbedExternalViewFromUris(roots, ctx, {
      hydration: 'basic',
      knownInteractors: true,
    })
    const batches = vi
      .mocked(hydrator.external.getKnownInteractors)
      .mock.calls.filter(
        ([, , collection]) =>
          collection === site.standard.graph.recommend.$type,
      )
      .map(([uris]) => uris)
    expect(batches.map((uris) => uris.length)).toEqual([100, 1])
    expect(batches.flat()).toEqual(roots)
    expect(state.externalKnownInteractors?.size).toBe(102)
  })

  it('shares lookup outcomes between exact and latest traversals', async ({
    fixture: { hydrator, ctx, records },
  }) => {
    using _exact = vi
      .spyOn(hydrator.external, 'getRecordsByRef')
      .mockImplementation(
        async (refs) =>
          new HydrationMap(
            refs.map((ref) => [
              genericRecordKey(ref),
              records.get(ref.uri) ?? null,
            ]),
          ),
      )
    const cache: ExternalKnownInteractors = new HydrationMap()
    const options = {
      hydration: 'basic',
      knownInteractors: true,
      knownInteractorsCache: cache,
    } as const
    const state = await hydrator.hydrateEmbedExternalViewFromRefs(
      [{ uri: document, cid }],
      ctx,
      options,
    )
    const article = views.externalRecordView(document, state, 0, cid)
    assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
    expect(article.viewer?.knownLikerCount).toBe(8)
    expect(article.publisher?.viewer?.knownSubscriberCount).toBe(8)
    await hydrator.hydrateEmbedExternalViewFromUris([document], ctx, options)
    expect(hydrator.external.getKnownInteractors).toHaveBeenCalledTimes(2)
  })

  it('does no personalized work for unauthenticated requests', async ({
    fixture: { hydrator, ctx },
  }) => {
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [document, gallery],
      ctx.copy({ viewer: null }),
      { knownInteractors: true },
    )
    expect(hydrator.external.getKnownInteractors).not.toHaveBeenCalled()
    expect(state.externalKnownInteractors).toBeUndefined()
    expect(modalityView(document, state).viewer).toBeUndefined()
  })

  it('deduplicates and bounds profile hydration without changing interaction order or counts', async ({
    fixture: { hydrator, ctx, known },
  }) => {
    known.set(document, {
      count: 12,
      actors: [viewer, newest, newest, older, oldest, owner],
    })
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [document],
      ctx,
      { hydration: 'basic', knownInteractors: true },
    )
    expect(state.externalKnownInteractors?.get(document)).toEqual({
      count: 12,
      actors: [newest, older, oldest],
    })
  })

  it.for([
    { lookup: 'unavailable', outcome: 'completed' },
    { lookup: 'failed', outcome: 'partial' },
    { lookup: 'incomplete', outcome: 'partial' },
  ] as const)(
    'reports $outcome when the known-interactor lookup is $lookup',
    async ({ lookup, outcome }, { fixture: { hydrator, ctx } }) => {
      using report = vi
        .spyOn(events, 'externalHydrationTraversal')
        .mockImplementation(() => {})
      const known = vi.mocked(hydrator.external.getKnownInteractors)
      if (lookup === 'unavailable') known.mockResolvedValue(undefined)
      else if (lookup === 'failed')
        known.mockRejectedValue(new Error('lookup failed'))
      else known.mockResolvedValue(new HydrationMap())

      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [document, gallery],
        ctx,
        { hydration: 'basic', knownInteractors: true },
      )
      expect(report).toHaveBeenCalledTimes(1)
      expect(report).toHaveBeenCalledWith(expect.objectContaining({ outcome }))
      for (const uri of [document, gallery, publication]) {
        expect(state.externalKnownInteractors?.get(uri)).toBeNull()
      }
      expect(modalityView(document, state).viewer).toEqual({})
      expect(hydrator.hydrateBidirectionalBlocks).not.toHaveBeenCalled()
    },
  )

  it('caches zero, failed, and unavailable outcomes without inventing zero counts', async ({
    fixture: { hydrator, ctx, known },
  }) => {
    const cache: ExternalKnownInteractors = new HydrationMap()
    known.set(document, { count: 0, actors: [] })
    vi.mocked(hydrator.external.getKnownInteractors).mockImplementation(
      async (uris, _viewer, collection) => {
        if (collection === social.grain.favorite.$type)
          throw new Error('lookup failed')
        if (collection === site.standard.graph.subscription.$type)
          return undefined
        return new HydrationMap(
          uris.map((uri) => [uri, known.get(uri) ?? null]),
        )
      },
    )
    const options = {
      hydration: 'basic',
      knownInteractors: true,
      knownInteractorsCache: cache,
    } as const
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [document, gallery],
      ctx,
      options,
    )
    expect(cache.get(document)).toEqual({ count: 0, actors: [] })
    expect(cache.get(gallery)).toBeNull()
    expect(cache.get(publication)).toBeNull()
    const article = views.externalRecordView(document, state)
    assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
    expect(article.viewer).toEqual({ knownLikers: [], knownLikerCount: 0 })
    const photos = views.externalRecordView(gallery, state)
    assert(photos && app.bsky.embed.external.viewGallery.$isTypeOf(photos))
    expect(photos.viewer?.knownLikerCount).toBeUndefined()
    expect(article.publisher?.viewer).toEqual({})
    await hydrator.hydrateEmbedExternalViewFromUris(
      [document, gallery],
      ctx,
      options,
    )
    expect(hydrator.external.getKnownInteractors).toHaveBeenCalledTimes(3)
  })

  it.for(['profiles', 'blocks'] as const)(
    'keeps outcomes unknown when %s hydration fails',
    async (failure, { fixture: { hydrator, ctx } }) => {
      using report = vi
        .spyOn(events, 'externalHydrationTraversal')
        .mockImplementation(() => {})
      if (failure === 'profiles') {
        const original = vi
          .mocked(hydrator.hydrateProfilesBasic)
          .getMockImplementation()!
        vi.mocked(hydrator.hydrateProfilesBasic).mockImplementation(
          async (dids, ...args) => {
            if (dids.includes(newest)) throw new Error('profiles unavailable')
            return original(dids, ...args)
          },
        )
      } else {
        vi.mocked(hydrator.hydrateBidirectionalBlocks).mockRejectedValue(
          new Error('blocks unavailable'),
        )
      }
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [document],
        ctx,
        { hydration: 'basic', knownInteractors: true },
      )
      expect(state.externalKnownInteractors?.get(document)).toBeNull()
      const article = views.externalRecordView(document, state)
      assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
      expect(article.viewer?.knownLikers).toBeUndefined()
      expect(article.title).toBe('Article')
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'partial' }),
      )
    },
  )

  it('filters unavailable and blocked profiles without reducing counts or expanding social proof recursively', async ({
    fixture: { hydrator, ctx, blocks, actors },
  }) => {
    blocks.set(owner, new HydrationMap([[newest, true]]))
    actors.get(older)!.takedownRef = 'takedown'
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [document],
      ctx,
      { hydration: 'basic', knownInteractors: true },
    )
    state.knownFollowers = new HydrationMap([
      [oldest, { count: 1, followers: [newest] }],
    ])
    state.profileViewers = new HydrationMap([[oldest, { did: oldest }]])
    const article = views.externalRecordView(document, state)
    assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
    expect(article.viewer?.knownLikers?.map(({ did }) => did)).toEqual([oldest])
    expect(article.viewer?.knownLikerCount).toBe(8)
    expect(
      article.viewer?.knownLikers?.[0].viewer?.knownFollowers,
    ).toBeUndefined()
    state.profileViewers.set(oldest, {
      did: oldest,
      blockedBy: atUri(viewer, app.bsky.graph.block.$type, 'blocked'),
    })
    expect(views.externalKnownInteractors(document, state)?.actors).toEqual([])
    state.ctx = ctx.copy({ skipViewerBlocks: true })
    expect(
      views
        .externalKnownInteractors(document, state)
        ?.actors.map(({ did }) => did),
    ).toEqual([oldest])
    state.actors?.set(oldest, null)
    expect(views.externalKnownInteractors(document, state)?.actors).toEqual([])
  })

  it.for([document, gallery])(
    'does not manufacture own-like state for %s',
    async (uri, { fixture: { hydrator, ctx } }) => {
      const state = await hydrator.hydrateEmbedExternalViewFromUris(
        [uri],
        ctx,
        { hydration: 'basic', knownInteractors: true },
      )
      const view = () => modalityView(uri, state)
      state.externalRecordLikes?.set(uri, null)
      expect(view()?.viewer).toBeUndefined()
      state.externalRecordLikes?.delete(uri)
      expect(view()?.viewer).toBeUndefined()
      const like = atUri(
        viewer,
        uri === document
          ? site.standard.graph.recommend.$type
          : social.grain.favorite.$type,
        'like',
      )
      state.externalRecordLikes?.set(uri, like)
      expect(view()?.viewer).toMatchObject({ like, knownLikerCount: 8 })
      state.ctx = ctx.copy({ viewer: null })
      expect(view()?.viewer).toBeUndefined()
    },
  )

  it('preserves publication subscription state and its unknown outcome', async ({
    fixture: { hydrator, ctx },
  }) => {
    const subscriptions = new HydrationMap<AtUriString, AtUriString | false>()
    const state = await hydrator.hydrateEmbedExternalViewFromUris(
      [document],
      ctx,
      {
        hydration: 'basic',
        knownInteractors: true,
        publicationSubscriptions: subscriptions,
      },
    )
    const view = () => modalityView(publication, state)
    const subscription = atUri(
      viewer,
      site.standard.graph.subscription.$type,
      'subscription',
    )
    subscriptions.set(publication, subscription)
    expect(view()?.viewer).toMatchObject({
      subscription,
      knownSubscriberCount: 8,
    })
    subscriptions.set(publication, null)
    expect(view()?.viewer).toBeUndefined()
  })
})
