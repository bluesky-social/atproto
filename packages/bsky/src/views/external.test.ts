import { Timestamp } from '@bufbuild/protobuf'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { assert, describe, expect, it, test, vi } from 'vitest'
import {
  type AtUriString,
  type DidString,
  type TypedLexMap,
  asDatetimeString,
  atUri,
  lexStringify,
  parseCid,
} from '@atproto/lex'
import type { ScopedFeatureGatesClient } from '../feature-gates/index.js'
import { ActorHydrator } from '../hydration/actor.js'
import type {
  ExternalRecordBacklinkCounts,
  ExternalRecordBacklinks,
  ExternalRecords,
} from '../hydration/external.js'
import {
  HydrateCtx,
  type HydrationState,
  mergeStates,
} from '../hydration/hydrator.js'
import { Labels } from '../hydration/label.js'
import { HydrationMap } from '../hydration/util.js'
import { ImageUriBuilder } from '../image/uri.js'
import { app, com, place, site, social } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import { ActorInfo, GetActorsResponse } from '../proto/bsky_pb.js'
import { Views } from './index.js'
import type { Label } from './types.js'
import { VideoUriBuilder } from './util.js'

const did = 'did:plc:author'
const publisherDid = 'did:plc:publisher'
const docUri = atUri(did, site.standard.document.$type, 'article')
const pubUri = atUri(
  publisherDid,
  site.standard.publication.$type,
  'publication',
)
const galleryUri = atUri(did, social.grain.gallery.$type, 'gallery')
const streamUri = atUri(did, place.stream.livestream.$type, 'stream')
const createdAt = '2026-01-01T00:00:00.000Z'
const cid = 'bafyreid6c2mfvztew4wrg7ld3m4o4ssbxz4miklv7u46mko3sjqdvaxzfa'
const blob = {
  $type: 'blob' as const,
  ref: parseCid('bafkreigh2akiscaildc5tww2o3w4g5ucuzji75ltsiqg2wfswnns66cinu'),
  mimeType: 'image/jpeg',
  size: 100,
}

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

function createState() {
  return {
    externalRecords: new HydrationMap() as ExternalRecords,
    externalRecordBacklinks: new HydrationMap() as ExternalRecordBacklinks,
    externalRecordBacklinkCounts:
      new HydrationMap() as ExternalRecordBacklinkCounts,
    actors: new HydrationMap(),
    profileViewers: new HydrationMap(),
    labels: new Labels(),
  } satisfies HydrationState
}

function addRecord(
  state: HydrationState,
  uri: AtUriString,
  record: TypedLexMap,
) {
  state.externalRecords!.set(uri, {
    record,
    cid,
    indexedAt: new Date(createdAt),
    sortedAt: new Date(createdAt),
    takedownRef: undefined,
  })
}

function addActor(state: HydrationState, did: DidString) {
  state.actors!.set(did, {
    did,
    handle: 'user.example.com',
    isLabeler: false,
    verifications: [],
    allowActivitySubscriptionsFrom: 'none',
    accountModerationTags: new Set(),
    profileModerationTags: new Set(),
  })
}

function addLabel(
  state: HydrationState,
  uri: AtUriString,
  val: string,
  isTakendown = false,
) {
  const label: Label = { src: 'did:plc:labeler', uri, val, cts: createdAt }
  state.labels!.set(uri, {
    isImpersonation: false,
    isTakendown,
    needsReview: false,
    labels: new HydrationMap([[Labels.key(label), label]]),
  })
}

function addPublication(state: HydrationState) {
  addRecord(
    state,
    pubUri,
    site.standard.publication.$build({
      name: 'A publication',
      url: 'https://example.com/blog',
      icon: blob,
      basicTheme: site.standard.theme.basic.$build({
        background: site.standard.theme.color.rgb.$build({
          r: 0,
          g: 15,
          b: 255,
        }),
        foreground: site.standard.theme.color.rgb.$build({
          r: 255,
          g: 128,
          b: 0,
        }),
        accent: site.standard.theme.color.rgb.$build({ r: 0, g: 0, b: 0 }),
        accentForeground: site.standard.theme.color.rgb.$build({
          r: 255,
          g: 255,
          b: 255,
        }),
      }),
    }),
  )
}

function addArticle(state: HydrationState, documentSite: string = pubUri) {
  addRecord(
    state,
    docUri,
    site.standard.document.$build({
      site: documentSite as site.standard.document.Main['site'],
      path: '/article',
      title: 'An article',
      publishedAt: createdAt,
      coverImage: blob,
      textContent: 'word '.repeat(201),
    }),
  )
}

function addGallery(state: HydrationState) {
  addRecord(
    state,
    galleryUri,
    social.grain.gallery.$build({ title: 'Photos', createdAt }),
  )
}

function addPhoto(
  state: HydrationState,
  rkey: string,
  position?: number,
  owner: DidString = did,
  gallery: AtUriString = galleryUri,
) {
  const photoUri = atUri(owner, social.grain.photo.$type, rkey)
  const linkUri = atUri(owner, social.grain.gallery.item.$type, rkey)
  addRecord(
    state,
    photoUri,
    social.grain.photo.$build({
      photo: blob,
      alt: rkey,
      aspectRatio: { width: 3, height: 2 },
    }),
  )
  addRecord(
    state,
    linkUri,
    social.grain.gallery.item.$build({
      gallery,
      item: photoUri,
      createdAt,
      ...(position === undefined ? {} : { position }),
    }),
  )
  state.externalRecordBacklinks!.set(galleryUri, [
    ...(state.externalRecordBacklinks!.get(galleryUri) ?? []),
    linkUri,
  ])
  return { photoUri, linkUri }
}

function assertValid(view: ReturnType<Views['externalRecordView']>) {
  assert(view)
  app.bsky.embed.getEmbedExternalView.$output.schema.validate({ data: view })
}

describe('record modality views', () => {
  it('builds an article with its publisher, refs, profiles, labels, images, and reading time', () => {
    const state = createState()
    addPublication(state)
    addArticle(state)
    addActor(state, did)
    addActor(state, publisherDid)
    addLabel(state, docUri, 'article-label')
    addLabel(state, pubUri, 'publication-label')
    state.externalRecords.get(docUri)!.record.labels =
      com.atproto.label.defs.selfLabels.$build({ values: [{ val: 'nudity' }] })
    state.externalRecordBacklinkCounts.set(docUri, {
      [site.standard.graph.recommend.$type]: 25,
    })
    state.externalRecordBacklinkCounts.set(pubUri, {
      [site.standard.graph.subscription.$type]: 50,
    })

    const view = views.externalRecordView(docUri, state)
    assert(view && app.bsky.embed.external.viewArticle.$isTypeOf(view))
    assertValid(view)
    expect(view).toMatchObject({
      uri: 'https://example.com/blog/article',
      title: 'An article',
      description: '',
      createdAt,
      readingTime: 2,
      likeCount: 25,
      image: `https://cdn.example.com/img/feed_thumbnail/plain/${did}/${blob.ref}`,
      associatedRefs: [
        { uri: docUri, cid },
        { uri: pubUri, cid },
      ],
      publisher: {
        uri: 'https://example.com/blog',
        description: '',
        logo: `https://cdn.example.com/img/avatar/plain/${publisherDid}/${blob.ref}`,
        subscriptionCount: 50,
        associatedRefs: [{ uri: pubUri, cid }],
        theme: {
          background: '#000fff',
          foreground: '#ff8000',
          accent: '#000000',
          accentForeground: '#ffffff',
        },
      },
    })
    expect(view.associatedProfiles?.map((p) => p.did)).toEqual([
      did,
      publisherDid,
    ])
    expect(view.labels?.map((l) => l.val)).toEqual([
      'article-label',
      'nudity',
      'publication-label',
    ])
    expect(view.labels?.find((l) => l.val === 'nudity')).toEqual({
      src: did,
      uri: docUri,
      cid,
      val: 'nudity',
      cts: createdAt,
    })
    expect(view.likers).toBeUndefined()
  })

  it('builds a standalone publication without inventing timestamps or engagement', () => {
    const state = createState()
    addPublication(state)
    const view = views.externalRecordView(pubUri, state)
    assert(
      view && app.bsky.embed.external.viewArticlePublication.$isTypeOf(view),
    )
    assertValid(view)
    expect(view.createdAt).toBeUndefined()
    expect(view.subscriptionCount).toBeUndefined()
    expect(view.subscribers).toBeUndefined()
    expect(view.associatedProfiles).toEqual([])
  })

  it('builds a loose document and omits reading time for blank text', () => {
    const state = createState()
    addArticle(state, 'https://example.com/blog/')
    state.externalRecords.get(docUri)!.record.textContent = '  \n\t '
    const view = views.externalRecordView(docUri, state)
    assert(view && app.bsky.embed.external.viewArticle.$isTypeOf(view))
    assertValid(view)
    expect(view.uri).toBe('https://example.com/blog/article')
    expect(view.publisher).toBeUndefined()
    expect(view.readingTime).toBeUndefined()
    expect(view.associatedRefs).toEqual([
      com.atproto.repo.strongRef.$build({ uri: docUri, cid }),
    ])
  })

  test.each(['missing', 'invalid', 'taken-down', 'blocked'] as const)(
    'rejects an article with a %s publisher',
    (kind) => {
      const state = createState()
      addArticle(state)
      if (kind !== 'missing') addPublication(state)
      if (kind === 'invalid') state.externalRecords.get(pubUri)!.record.name = 1
      if (kind === 'taken-down') addLabel(state, pubUri, '!takedown', true)
      if (kind === 'blocked')
        state.profileViewers.set(publisherDid, {
          did: publisherDid,
          blocking: atUri(did, app.bsky.graph.block.$type, 'block'),
        })
      expect(views.externalRecordView(docUri, state)).toBeUndefined()
    },
  )

  test.each(['javascript:alert(1)', 'not a url'])(
    'rejects an unsafe article site: %s',
    (url) => {
      const state = createState()
      addArticle(state, url)
      expect(views.externalRecordView(docUri, state)).toBeUndefined()
    },
  )

  it('builds a gallery in position order, defaulting missing positions without mutating records', () => {
    const state = createState()
    addGallery(state)
    const second = addPhoto(state, 'second', 2)
    const first = addPhoto(state, 'first')
    const other = addPhoto(state, 'other', 0)
    Object.freeze(state.externalRecords.get(first.linkUri)!.record)
    addLabel(state, first.photoUri, 'photo-label')
    const before = [...state.externalRecordBacklinks.get(galleryUri)!]

    const view = views.externalRecordView(galleryUri, state)
    assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
    assertValid(view)
    expect(view.uri).toBe(galleryUri)
    expect(view.description).toBe('')
    expect(
      view.items
        .filter(app.bsky.embed.external.viewGalleryImage.$isTypeOf)
        .map((item) => item.alt),
    ).toEqual(['first', 'other', 'second'])
    expect(view.items[0]).toMatchObject({
      $type: app.bsky.embed.external.viewGalleryImage.$type,
      thumbnail: `https://cdn.example.com/img/feed_thumbnail/plain/${did}/${blob.ref}`,
      fullsize: `https://cdn.example.com/img/feed_fullsize/plain/${did}/${blob.ref}`,
      aspectRatio: { width: 3, height: 2 },
    })
    expect(view.associatedRefs?.map((ref) => ref.uri)).toEqual([
      galleryUri,
      first.linkUri,
      first.photoUri,
      other.linkUri,
      other.photoUri,
      second.linkUri,
      second.photoUri,
    ])
    expect(view.labels?.map((l) => l.val)).toEqual(['photo-label'])
    expect(state.externalRecords.get(first.linkUri)!.record).not.toHaveProperty(
      'position',
    )
    expect(state.externalRecordBacklinks.get(galleryUri)).toEqual(before)
  })

  it('drops unrelated, foreign-authored, duplicate, missing, invalid, and taken-down gallery items', () => {
    const state = createState()
    addGallery(state)
    const good = addPhoto(state, 'good')
    addPhoto(state, 'foreign', 0, publisherDid)
    addPhoto(
      state,
      'unrelated',
      0,
      did,
      atUri(did, social.grain.gallery.$type, 'other'),
    )
    const missing = addPhoto(state, 'missing')
    state.externalRecords.set(missing.photoUri, null)
    const invalid = addPhoto(state, 'invalid')
    state.externalRecords.get(invalid.photoUri)!.record.alt = 123
    const takenDown = addPhoto(state, 'taken-down')
    addLabel(state, takenDown.photoUri, '!takedown', true)
    state.externalRecordBacklinks.get(galleryUri)!.push(good.linkUri)
    const view = views.externalRecordView(galleryUri, state)
    assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
    assertValid(view)
    expect(
      view.items
        .filter(app.bsky.embed.external.viewGalleryImage.$isTypeOf)
        .map((item) => item.alt),
    ).toEqual(['good'])
    expect(view.associatedRefs?.map((ref) => ref.uri)).toEqual([
      galleryUri,
      good.linkUri,
      good.photoUri,
    ])
  })

  it('allows an empty gallery', () => {
    const state = createState()
    addGallery(state)
    const view = views.externalRecordView(galleryUri, state)
    assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
    assertValid(view)
    expect(view.items).toEqual([])
  })

  test.each([
    { note: 'no timeout', timeout: undefined, now: 60000, active: true },
    {
      note: 'explicitly disabled timeout',
      timeout: 0,
      now: 60000,
      active: true,
    },
    { note: 'before timeout', timeout: 60, now: 59999, active: true },
    { note: 'at timeout', timeout: 60, now: 60000, active: false },
    {
      note: 'heartbeat extends timeout',
      timeout: 60,
      lastSeenAt: '2026-01-01T00:01:00.000Z',
      now: 61000,
      active: true,
    },
    {
      note: 'ended streams stay ended',
      timeout: 0,
      endedAt: '2026-01-01T00:00:30.000Z',
      now: 60000,
      active: false,
    },
  ])('$note', ({ timeout, lastSeenAt, endedAt, now, active }) => {
    const state = createState()
    addRecord(
      state,
      streamUri,
      place.stream.livestream.$build({
        title: 'A stream',
        createdAt,
        lastSeenAt: lastSeenAt ? asDatetimeString(lastSeenAt) : undefined,
        endedAt: endedAt ? asDatetimeString(endedAt) : undefined,
        idleTimeoutSeconds: timeout,
        canonicalUrl: 'https://stream.example.com/canonical',
        url: 'https://station.example.com/replication',
        thumb: blob,
      }),
    )
    const view = views.externalRecordView(
      streamUri,
      state,
      Date.parse(createdAt) + now,
    )
    assert(view && app.bsky.embed.external.viewLivestream.$isTypeOf(view))
    assertValid(view)
    expect(view).toMatchObject({
      uri: 'https://stream.example.com/canonical',
      active,
      createdAt,
      startedAt: createdAt,
      description: '',
      image: `https://cdn.example.com/img/feed_thumbnail/plain/${did}/${blob.ref}`,
    })
    expect(view.endedAt).toBe(endedAt)
  })

  test.each([
    {
      url: 'https://station.example.com/stream',
      expected: 'https://station.example.com/stream',
    },
    { url: undefined, expected: streamUri },
    { url: 'javascript:alert(1)', expected: streamUri },
  ])(
    'falls back from missing canonical URL to $expected',
    ({ url, expected }) => {
      const state = createState()
      addRecord(
        state,
        streamUri,
        place.stream.livestream.$build({
          title: 'A stream',
          createdAt,
          url: url as place.stream.livestream.Main['url'],
        }),
      )
      expect(views.externalRecordView(streamUri, state)?.uri).toBe(expected)
    },
  )

  it('deduplicates and sorts available liker profiles by DID, caps at three, and keeps total counts', () => {
    const state = createState()
    addGallery(state)
    const backlinks: AtUriString[] = []
    for (const name of ['e', 'b', 'c', 'a', 'd', 'b']) {
      const actorDid = `did:plc:${name}` as const
      const uri = atUri(
        actorDid,
        social.grain.favorite.$type,
        String(backlinks.length),
      )
      addRecord(
        state,
        uri,
        social.grain.favorite.$build({ subject: galleryUri, createdAt }),
      )
      if (name !== 'a') addActor(state, actorDid)
      backlinks.push(uri)
    }
    const unrelated = atUri(
      'did:plc:unrelated',
      social.grain.favorite.$type,
      'like',
    )
    addRecord(
      state,
      unrelated,
      social.grain.favorite.$build({ subject: docUri, createdAt }),
    )
    addActor(state, 'did:plc:unrelated')
    backlinks.push(unrelated)
    state.externalRecordBacklinks.set(galleryUri, backlinks)
    state.externalRecordBacklinkCounts.set(galleryUri, {
      [social.grain.favorite.$type]: 100,
    })
    const view = views.externalRecordView(galleryUri, state)
    assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
    assertValid(view)
    expect(view.likeCount).toBe(100)
    expect(view.likers?.map((p) => p.did)).toEqual([
      'did:plc:b',
      'did:plc:c',
      'did:plc:d',
    ])
    state.externalRecordBacklinks.set(galleryUri, backlinks.toReversed())
    expect(views.externalRecordView(galleryUri, state)).toEqual(view)

    state.profileViewers.set('did:plc:c', {
      did: 'did:plc:c',
      blocking: atUri(did, app.bsky.graph.block.$type, 'block'),
    })
    addLabel(
      state,
      atUri('did:plc:d', social.grain.favorite.$type, '4'),
      '!takedown',
      true,
    )
    const filtered = views.externalRecordView(galleryUri, state)
    assert(filtered && app.bsky.embed.external.viewGallery.$isTypeOf(filtered))
    expect(filtered.likers?.map((p) => p.did)).toEqual([
      'did:plc:b',
      'did:plc:e',
    ])
    expect(filtered.likeCount).toBe(100)
  })

  it('selects recommendation and subscription previews using the correct target fields', () => {
    const state = createState()
    addPublication(state)
    addArticle(state)
    addActor(state, 'did:plc:reader')
    const recommend = atUri(
      'did:plc:reader',
      site.standard.graph.recommend.$type,
      'recommend',
    )
    const subscribe = atUri(
      'did:plc:reader',
      site.standard.graph.subscription.$type,
      'subscription',
    )
    addRecord(
      state,
      recommend,
      site.standard.graph.recommend.$build({ document: docUri, createdAt }),
    )
    addRecord(
      state,
      subscribe,
      site.standard.graph.subscription.$build({ publication: pubUri }),
    )
    state.externalRecordBacklinks.set(docUri, [recommend, subscribe])
    state.externalRecordBacklinks.set(pubUri, [recommend, subscribe])
    const view = views.externalRecordView(docUri, state)
    assert(view && app.bsky.embed.external.viewArticle.$isTypeOf(view))
    assertValid(view)
    expect(view.likers?.map((p) => p.did)).toEqual(['did:plc:reader'])
    expect(view.publisher?.subscribers?.map((p) => p.did)).toEqual([
      'did:plc:reader',
    ])
  })

  test.each([undefined, 0, -1, Number.MAX_SAFE_INTEGER + 1])(
    'handles an engagement count of %s',
    (count) => {
      const state = createState()
      addGallery(state)
      state.externalRecordBacklinkCounts.set(
        galleryUri,
        count === undefined ? {} : { [social.grain.favorite.$type]: count },
      )
      const view = views.externalRecordView(galleryUri, state)
      assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
      expect(view.likeCount).toBe(
        count === undefined || count === 0 ? 0 : undefined,
      )
      expect(view.likers).toBeUndefined()
    },
  )

  test.each([
    'missing',
    'invalid',
    'wrong-collection',
    'taken-down',
    'takedown-label',
    'blocked',
    'deactivated',
    'needs-review',
  ] as const)('omits a %s record', (kind) => {
    const state = createState()
    addGallery(state)
    if (kind === 'missing') state.externalRecords.set(galleryUri, null)
    if (kind === 'invalid')
      state.externalRecords.get(galleryUri)!.record.title = 1
    if (kind === 'wrong-collection')
      state.externalRecords.get(galleryUri)!.record =
        place.stream.livestream.$build({
          title: 'Wrong collection',
          createdAt,
        })
    if (kind === 'taken-down')
      state.externalRecords.get(galleryUri)!.takedownRef = 'ref'
    if (kind === 'takedown-label')
      addLabel(state, galleryUri, '!takedown', true)
    if (kind === 'blocked')
      state.profileViewers.set(did, {
        did,
        blockedBy: atUri(did, app.bsky.graph.block.$type, 'block'),
      })
    if (kind === 'deactivated') {
      addActor(state, did)
      state.actors.get(did)!.upstreamStatus = 'deactivated'
    }
    if (kind === 'needs-review') {
      addLabel(state, galleryUri, 'needs-review')
      state.labels.get(galleryUri)!.needsReview = true
    }
    expect(views.externalRecordView(galleryUri, state)).toBeUndefined()
  })

  describe('with actors from normal hydration', () => {
    const dataplane = createPromiseClient(
      Service,
      createRouterTransport(() => {}),
    )
    const actorHydrator = new ActorHydrator(dataplane)
    const reader = 'did:plc:reader'
    const unavailableStatuses = {
      deactivated: { upstreamStatus: 'deactivated' },
      'taken-down': { takenDown: true },
      suspended: { upstreamStatus: 'suspended' },
      deleted: { exists: false },
      tombstoned: { tombstonedAt: Timestamp.fromDate(new Date(createdAt)) },
    } satisfies Record<string, Partial<ActorInfo>>
    type Status = 'active' | keyof typeof unavailableStatuses

    async function hydrateActors(
      state: HydrationState,
      statuses: Partial<Record<DidString, Status>>,
      includeTakedowns = false,
    ) {
      const dids = Object.keys(statuses) as DidString[]
      using _ = vi.spyOn(dataplane, 'getActors').mockResolvedValue(
        new GetActorsResponse({
          actors: dids.map((actorDid) => {
            const status = statuses[actorDid]!
            return new ActorInfo({
              exists: true,
              handle: 'user.example.com',
              ...(status === 'active' ? {} : unavailableStatuses[status]),
            })
          }),
        }),
      )
      state.actors = await actorHydrator.getActors(dids, { includeTakedowns })
      state.ctx = new HydrateCtx({
        labelers: { dids: [], redact: new Set() },
        viewer: null,
        includeTakedowns,
        features: {} as ScopedFeatureGatesClient,
      })
    }

    test.each(Object.keys(unavailableStatuses) as Status[])(
      'omits a record whose owner is %s',
      async (status) => {
        const state = createState()
        addGallery(state)
        await hydrateActors(state, { [did]: status })
        expect(state.actors.get(did)).toBeNull()
        expect(views.externalRecordView(galleryUri, state)).toBeUndefined()
      },
    )

    test.each([
      { status: 'deactivated', available: true },
      { status: 'taken-down', available: true },
      { status: 'suspended', available: true },
      { status: 'deleted', available: false },
      { status: 'tombstoned', available: false },
    ] as const)(
      'with includeTakedowns, a $status owner keeps the record available: $available',
      async ({ status, available }) => {
        const state = createState()
        addGallery(state)
        await hydrateActors(state, { [did]: status }, true)
        expect(state.actors.get(did) === null).toBe(!available)
        const view = views.externalRecordView(galleryUri, state)
        if (available) {
          assertValid(view)
          expect(view?.associatedProfiles?.map((p) => p.did)).toEqual([did])
        } else {
          expect(view).toBeUndefined()
        }
      },
    )

    it('keeps records whose owner is absent from hydration state', async () => {
      const state = createState()
      addGallery(state)
      await hydrateActors(state, { [reader]: 'active' })
      expect(state.actors.has(did)).toBe(false)
      const view = views.externalRecordView(galleryUri, state)
      assertValid(view)
      expect(view?.associatedProfiles).toEqual([])
    })

    test.each(Object.keys(unavailableStatuses) as Status[])(
      'omits an article and publication whose publisher is %s',
      async (status) => {
        const state = createState()
        addPublication(state)
        addArticle(state)
        await hydrateActors(state, { [did]: 'active', [publisherDid]: status })
        expect(views.externalRecordView(pubUri, state)).toBeUndefined()
        expect(views.externalRecordView(docUri, state)).toBeUndefined()
      },
    )

    test.each(Object.keys(unavailableStatuses) as Status[])(
      'drops gallery photos and likers from a %s actor without changing counts',
      async (status) => {
        const state = createState()
        addGallery(state)
        const kept = addPhoto(state, 'kept')
        const photoUri = atUri(reader, social.grain.photo.$type, 'photo')
        const linkUri = atUri(did, social.grain.gallery.item.$type, 'photo')
        addRecord(
          state,
          photoUri,
          social.grain.photo.$build({ photo: blob, alt: 'leaked' }),
        )
        addRecord(
          state,
          linkUri,
          social.grain.gallery.item.$build({
            gallery: galleryUri,
            item: photoUri,
            createdAt,
            position: -1,
          }),
        )
        const favoriteUri = atUri(reader, social.grain.favorite.$type, 'fav')
        addRecord(
          state,
          favoriteUri,
          social.grain.favorite.$build({ subject: galleryUri, createdAt }),
        )
        state.externalRecordBacklinks
          .get(galleryUri)!
          .push(linkUri, favoriteUri)
        state.externalRecordBacklinkCounts.set(galleryUri, {
          [social.grain.favorite.$type]: 7,
        })
        await hydrateActors(state, { [did]: 'active', [reader]: status })

        const view = views.externalRecordView(galleryUri, state)
        assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
        assertValid(view)
        expect(
          view.items
            .filter(app.bsky.embed.external.viewGalleryImage.$isTypeOf)
            .map((item) => item.alt),
        ).toEqual(['kept'])
        expect(view.associatedRefs?.map((ref) => ref.uri)).toEqual([
          galleryUri,
          kept.linkUri,
          kept.photoUri,
        ])
        expect(view.associatedProfiles?.map((p) => p.did)).toEqual([did])
        expect(view.likers).toEqual([])
        expect(view.likeCount).toBe(7)
      },
    )
  })

  describe('strict source record validation', () => {
    const naive = '2026-01-01T00:00:00'

    function addStream(state: HydrationState, fields: object = {}) {
      addRecord(state, streamUri, {
        ...place.stream.livestream.$build({ title: 'A stream', createdAt }),
        ...fields,
      })
    }

    test.each([
      {
        note: 'article publishedAt',
        uri: docUri,
        add: (state: HydrationState) => {
          addArticle(state, 'https://example.com/blog')
          state.externalRecords!.get(docUri)!.record.publishedAt = naive
        },
      },
      {
        note: 'article updatedAt',
        uri: docUri,
        add: (state: HydrationState) => {
          addArticle(state, 'https://example.com/blog')
          state.externalRecords!.get(docUri)!.record.updatedAt = naive
        },
      },
      {
        note: 'gallery createdAt',
        uri: galleryUri,
        add: (state: HydrationState) => {
          addGallery(state)
          state.externalRecords!.get(galleryUri)!.record.createdAt = naive
        },
      },
      {
        note: 'livestream createdAt',
        uri: streamUri,
        add: (state: HydrationState) => addStream(state, { createdAt: naive }),
      },
      {
        note: 'livestream endedAt',
        uri: streamUri,
        add: (state: HydrationState) => addStream(state, { endedAt: naive }),
      },
      {
        note: 'livestream lastSeenAt',
        uri: streamUri,
        add: (state: HydrationState) =>
          addStream(state, { lastSeenAt: naive, idleTimeoutSeconds: 60 }),
      },
    ])('rejects a timezone-less $note', ({ uri, add }) => {
      const state = createState()
      add(state)
      const before = lexStringify(state.externalRecords.get(uri)!.record)
      expect(views.externalRecordView(uri, state)).toBeUndefined()
      expect(lexStringify(state.externalRecords.get(uri)!.record)).toBe(before)
    })

    it('rejects an article whose publisher fails strict blob validation', () => {
      const state = createState()
      addPublication(state)
      addArticle(state)
      state.externalRecords.get(pubUri)!.record.icon = {
        ...blob,
        mimeType: 'application/pdf',
      }
      expect(views.externalRecordView(pubUri, state)).toBeUndefined()
      expect(views.externalRecordView(docUri, state)).toBeUndefined()
    })

    it('omits gallery items and photos with timezone-less timestamps', () => {
      const state = createState()
      addGallery(state)
      const kept = addPhoto(state, 'kept')
      const badLink = addPhoto(state, 'bad-link')
      state.externalRecords.get(badLink.linkUri)!.record.createdAt = naive
      const badPhoto = addPhoto(state, 'bad-photo')
      state.externalRecords.get(badPhoto.photoUri)!.record.createdAt = naive
      const view = views.externalRecordView(galleryUri, state)
      assert(view && app.bsky.embed.external.viewGallery.$isTypeOf(view))
      assertValid(view)
      expect(view.associatedRefs?.map((ref) => ref.uri)).toEqual([
        galleryUri,
        kept.linkUri,
        kept.photoUri,
      ])
    })

    it('omits backlink samples with timezone-less timestamps but keeps counts', () => {
      const state = createState()
      addPublication(state)
      addArticle(state)
      addGallery(state)
      const reader = 'did:plc:reader'
      addActor(state, reader)
      const recommend = atUri(
        reader,
        site.standard.graph.recommend.$type,
        'recommend',
      )
      const subscribe = atUri(
        reader,
        site.standard.graph.subscription.$type,
        'subscription',
      )
      const favorite = atUri(reader, social.grain.favorite.$type, 'favorite')
      addRecord(state, recommend, {
        ...site.standard.graph.recommend.$build({
          document: docUri,
          createdAt,
        }),
        createdAt: naive,
      })
      addRecord(
        state,
        subscribe,
        site.standard.graph.subscription.$build({
          publication: pubUri,
          createdAt: asDatetimeString(createdAt),
        }),
      )
      state.externalRecords.get(subscribe)!.record.createdAt = naive
      addRecord(state, favorite, {
        ...social.grain.favorite.$build({ subject: galleryUri, createdAt }),
        createdAt: naive,
      })
      state.externalRecordBacklinks.set(docUri, [recommend])
      state.externalRecordBacklinks.set(pubUri, [subscribe])
      state.externalRecordBacklinks.set(galleryUri, [favorite])
      state.externalRecordBacklinkCounts.set(docUri, {
        [site.standard.graph.recommend.$type]: 3,
      })
      state.externalRecordBacklinkCounts.set(pubUri, {
        [site.standard.graph.subscription.$type]: 4,
      })
      state.externalRecordBacklinkCounts.set(galleryUri, {
        [social.grain.favorite.$type]: 5,
      })

      const article = views.externalRecordView(docUri, state)
      assert(article && app.bsky.embed.external.viewArticle.$isTypeOf(article))
      assertValid(article)
      expect(article.likers).toEqual([])
      expect(article.likeCount).toBe(3)
      expect(article.publisher?.subscribers).toEqual([])
      expect(article.publisher?.subscriptionCount).toBe(4)
      const gallery = views.externalRecordView(galleryUri, state)
      assert(gallery && app.bsky.embed.external.viewGallery.$isTypeOf(gallery))
      assertValid(gallery)
      expect(gallery.likers).toEqual([])
      expect(gallery.likeCount).toBe(5)
    })

    it('preserves valid timestamps and leaves source records untouched', () => {
      const state = createState()
      addArticle(state, 'https://example.com/blog')
      const updatedAt = '2026-01-02T03:04:05.678+02:00'
      state.externalRecords.get(docUri)!.record.updatedAt = updatedAt
      addStream(state, {
        endedAt: '2026-01-01T00:30:00Z',
        lastSeenAt: '2026-01-01T00:20:00Z',
      })
      const before = [docUri, streamUri].map((uri) =>
        lexStringify(state.externalRecords.get(uri)!.record),
      )
      const article = views.externalRecordView(docUri, state)
      assertValid(article)
      expect(article).toMatchObject({ createdAt, updatedAt })
      const stream = views.externalRecordView(streamUri, state)
      assertValid(stream)
      expect(stream).toMatchObject({
        createdAt,
        startedAt: createdAt,
        endedAt: '2026-01-01T00:30:00Z',
        active: false,
      })
      expect(
        [docUri, streamUri].map((uri) =>
          lexStringify(state.externalRecords.get(uri)!.record),
        ),
      ).toEqual(before)
    })
  })

  it('omits unsupported collections', () => {
    const state = createState()
    const uri = atUri(did, app.bsky.feed.post.$type, 'post')
    addRecord(
      state,
      uri,
      app.bsky.feed.post.$build({ text: 'Not a modality', createdAt }),
    )
    expect(views.externalRecordView(uri, state)).toBeUndefined()
  })

  it('preserves generic record hydration when merging states', () => {
    const first = createState()
    const second = createState()
    addGallery(first)
    addArticle(second, 'https://example.com')
    first.externalRecordBacklinks.set(galleryUri, [])
    second.externalRecordBacklinks.set(docUri, [])
    first.externalRecordBacklinkCounts.set(galleryUri, {})
    second.externalRecordBacklinkCounts.set(docUri, {})
    const merged = mergeStates(first, second)
    expect([...merged.externalRecords!.keys()]).toEqual([galleryUri, docUri])
    expect([...merged.externalRecordBacklinks!.keys()]).toEqual([
      galleryUri,
      docUri,
    ])
    expect([...merged.externalRecordBacklinkCounts!.keys()]).toEqual([
      galleryUri,
      docUri,
    ])
  })
})
