import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, test, vi } from 'vitest'
import {
  type AtUriString,
  type TypedLexMap,
  atUri,
  currentDatetimeString,
  lexStringify,
  parseCid,
  toDatetimeString,
} from '@atproto/lex'
import { AuthRequiredError, createServer } from '@atproto/xrpc-server'
import register from '../src/api/app/bsky/unspecced/getAtmosphereExploreTab.js'
import { ServerConfig } from '../src/config.js'
import type { AppContext } from '../src/context.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, type com, place, site, social } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import {
  GetAtmosphereBacklinksResponse,
  RecordLookupStatus,
} from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const grainGallery = social.grain.gallery
const grainGalleryItem = social.grain.gallery.item
const grainPhoto = social.grain.photo
const streamLivestream = place.stream.livestream
const nativeFetch = globalThis.fetch
const author = 'did:plc:author'
const viewer = 'did:plc:viewer'
const labeler = 'did:plc:labeler'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const photoCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const publishedAt = '2026-10-01T00:00:00.000Z'
const docUri = atUri(author, site.standard.document.$type, 'story')
const pubUri = atUri(author, site.standard.publication.$type, 'publication')
const galleryUri = atUri(author, grainGallery.$type, 'gallery')
const itemUri = atUri(author, grainGalleryItem.$type, 'item')
const photoUri = atUri(author, grainPhoto.$type, 'photo')
const liveUri = atUri(author, streamLivestream.$type, 'live')
const missingUri = atUri(author, site.standard.document.$type, 'missing')
const group = (uris: unknown[]) => ({ uris })
const service = 'https://cms.bsky.app/atmosphere-explore-tab'
const frozenNow = Date.parse(publishedAt)
const at = (offsetMs: number) => toDatetimeString(frozenNow + offsetMs)
const lists = [
  {
    key: 'articles',
    baseUri: docUri,
    uriFor: (name: string) => atUri(author, site.standard.document.$type, name),
  },
  {
    key: 'publications',
    baseUri: pubUri,
    uriFor: (name: string) =>
      atUri(author, site.standard.publication.$type, name),
  },
  {
    key: 'photos',
    baseUri: galleryUri,
    uriFor: (name: string) => atUri(author, grainGallery.$type, name),
  },
  {
    key: 'livestreams',
    baseUri: liveUri,
    uriFor: (name: string) => atUri(author, streamLivestream.$type, name),
  },
] as const
type ListKey = (typeof lists)[number]['key']

async function setup(config: unknown = {}) {
  const records = new Map<AtUriString, TypedLexMap>([
    [
      docUri,
      site.standard.document.$build({
        title: 'Article',
        site: pubUri,
        path: '/story',
        publishedAt,
        textContent: 'one two three',
      }),
    ],
    [
      pubUri,
      site.standard.publication.$build({
        name: 'Publication',
        url: 'https://example.com/blog',
        basicTheme: site.standard.theme.basic.$build({
          background: site.standard.theme.color.rgb.$build({
            r: 255,
            g: 255,
            b: 255,
          }),
          foreground: site.standard.theme.color.rgb.$build({
            r: 0,
            g: 0,
            b: 0,
          }),
          accent: site.standard.theme.color.rgb.$build({
            r: 0,
            g: 100,
            b: 255,
          }),
          accentForeground: site.standard.theme.color.rgb.$build({
            r: 255,
            g: 255,
            b: 255,
          }),
        }),
      }),
    ],
    [
      galleryUri,
      grainGallery.$build({ title: 'Gallery', createdAt: publishedAt }),
    ],
    [
      itemUri,
      grainGalleryItem.$build({
        gallery: galleryUri,
        item: photoUri,
        position: 0,
        createdAt: publishedAt,
      }),
    ],
    [
      photoUri,
      grainPhoto.$build({
        photo: {
          $type: 'blob',
          ref: parseCid(photoCid),
          mimeType: 'image/jpeg',
          size: 12,
        },
        alt: 'A photo',
      }),
    ],
    [
      liveUri,
      streamLivestream.$build({
        title: 'Live',
        url: 'https://stream.place/replication',
        canonicalUrl: 'https://stream.place/author',
        createdAt: publishedAt,
        lastSeenAt: currentDatetimeString(),
        thumb: {
          $type: 'blob',
          ref: parseCid(photoCid),
          mimeType: 'image/jpeg',
          size: 12,
        },
      }),
    ],
  ])
  const takenDown = new Set<string>()
  const takenDownActors = new Set<string>()
  const blockedActors = new Set<string>()
  const labels: com.atproto.label.defs.Label[] = []
  const lookup = (uri: string) => {
    const record = records.get(uri as AtUriString)
    return {
      ref: { uri, cid },
      status: takenDown.has(uri)
        ? RecordLookupStatus.TAKEN_DOWN
        : record
          ? RecordLookupStatus.FOUND
          : RecordLookupStatus.NOT_FOUND,
      record: record
        ? { cid, record: Buffer.from(lexStringify(record)) }
        : undefined,
    }
  }
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(({ service }) => {
      service(Service, {
        getRecordsByURI: ({ uris }) => ({ results: uris.map(lookup) }),
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => ({
            targetUri,
            counts: {
              [site.standard.graph.recommend.$type]: 7n,
              [site.standard.graph.subscription.$type]: 4n,
            },
          })),
        }),
        getAtmosphereBacklinks: ({ collection, targetUri }) => ({
          backlinks:
            collection === grainGalleryItem.$type && targetUri === galleryUri
              ? [{ uri: itemUri }]
              : [],
        }),
        getActors: ({ dids }) => ({
          actors: dids.map((did) => ({
            exists: true,
            handle: 'author.test',
            takenDown: takenDownActors.has(did),
          })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map((did) => ({
            following: atUri(viewer, app.bsky.graph.follow.$type, 'follow'),
            blockedBy: blockedActors.has(did)
              ? atUri(did as typeof author, app.bsky.graph.block.$type, 'block')
              : '',
          })),
        }),
        getLabels: () => ({
          labels: labels.map((label) => Buffer.from(lexStringify(label))),
        }),
      })
    }),
  )
  const hydrator = new Hydrator(dataplane, [labeler], {
    debugFieldAllowedDids: new Set(),
    featureGatesClient: new FeatureGatesClient({}),
  })
  const views = new Views({
    imgUriBuilder: new ImageUriBuilder('https://images.example.com'),
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
  const cfg = { atmosphereExploreTabService: service as string | undefined }
  const ctx = {
    cfg,
    hydrator,
    views,
    reqLabelers: () => ({ dids: [labeler], redact: new Set([labeler]) }),
    authVerifier: {
      standardOptional: async ({ req }) => {
        if (
          req.headers.authorization &&
          req.headers.authorization !== 'Bearer valid'
        )
          throw new AuthRequiredError()
        return req.headers.authorization
          ? {
              credentials: {
                type: 'standard',
                iss: viewer,
                aud: 'did:plc:appview',
              },
            }
          : { credentials: { type: 'none', iss: null } }
      },
    } satisfies Pick<AppContext['authVerifier'], 'standardOptional'>,
  } as unknown as AppContext
  const xrpc = createServer([], { validateResponse: true })
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => Response.json(config))
  register(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listen address')
  return {
    records,
    takenDown,
    takenDownActors,
    blockedActors,
    labels,
    dataplane,
    hydrator,
    cfg,
    fetchMock,
    query: async (
      authenticated = false,
      params: app.bsky.unspecced.getAtmosphereExploreTab.$Params = {},
      headers: Record<string, string> = {},
    ) => {
      const url = new URL(
        `http://127.0.0.1:${address.port}/xrpc/${app.bsky.unspecced.getAtmosphereExploreTab.$lxm}`,
      )
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, item)
        } else if (value !== undefined) {
          url.searchParams.set(key, value)
        }
      }
      const response = await nativeFetch(url, {
        headers: {
          ...(authenticated ? { authorization: 'Bearer valid' } : {}),
          ...headers,
        },
      })
      const body = await response.json()
      return {
        status: response.status,
        body: body as app.bsky.unspecced.getAtmosphereExploreTab.$OutputBody,
      }
    },
    async [Symbol.asyncDispose]() {
      fetchMock.mockRestore()
      await server[Symbol.asyncDispose]()
    },
  }
}

const curatedBanner = {
  id: 'banner',
  title: 'Explore',
  image: 'https://example.com/banner.jpg',
}
const curated = {
  announcementBanners: [{ ...curatedBanner, status: 'enabled' }],
  articles: [group([missingUri]), group([docUri]), group([docUri])],
  publications: [group([pubUri])],
  photos: [group([galleryUri])],
  livestreams: [group([liveUri])],
  apps: [{ id: 'app', title: 'An app', url: 'https://example.com/app' }],
}

describe('Atmosphere Explore', () => {
  it('hydrates canonical views, associations, and ordering', async () => {
    await using fixture = await setup(curated)
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { status, body } = await fixture.query()
    expect(hydrate).toHaveBeenCalledWith(
      [missingUri, docUri, pubUri, galleryUri, liveUri],
      expect.objectContaining({ viewer: null }),
    )
    expect(hydrate.mock.calls.filter(([, , seen]) => !seen)).toHaveLength(1)
    expect(status).toBe(200)
    expect(body.announcementBanner).toEqual(curatedBanner)
    expect(body.apps).toEqual(curated.apps)
    expect(body.articles.map(({ featured }) => featured)).toEqual([
      false,
      false,
    ])
    const article = body.articles[0].view
    expect(app.bsky.embed.external.viewArticle.$matches(article)).toBe(true)
    expect(article).toMatchObject({
      title: 'Article',
      uri: 'https://example.com/blog/story',
      likeCount: 7,
      readingTime: 1,
    })
    expect(body.articles[1].view.associatedRefs?.map(({ uri }) => uri)).toEqual(
      [docUri, pubUri],
    )
    expect(article.publisher).toMatchObject({
      title: 'Publication',
      subscriptionCount: 4,
      theme: { background: '#ffffff', accent: '#0064ff' },
    })
    expect(
      app.bsky.embed.external.viewArticlePublication.$matches(
        body.publications[0].view,
      ),
    ).toBe(true)
    const gallery = body.photos[0].view
    expect(app.bsky.embed.external.viewGallery.$matches(gallery)).toBe(true)
    expect(gallery.uri).toBe(galleryUri)
    expect(gallery.associatedRefs?.map(({ uri }) => uri)).toEqual([
      galleryUri,
      itemUri,
      photoUri,
    ])
    expect(gallery.items[0]).toMatchObject({
      $type: app.bsky.embed.external.viewGalleryImage.$type,
      thumbnail: `https://images.example.com/feed_thumbnail/plain/${author}/${photoCid}`,
      alt: 'A photo',
    })
    expect(body.livestreams[0].view).toMatchObject({
      $type: app.bsky.embed.external.viewLivestream.$type,
      uri: 'https://stream.place/author',
      image: `https://images.example.com/feed_thumbnail/plain/${author}/${photoCid}`,
      active: true,
      startedAt: publishedAt,
    })
    const request = fixture.fetchMock.mock.calls[0][0] as Request
    expect(request.url).toBe(service)
    expect(request.headers.get('authorization')).toBeNull()
    expect(request.redirect).toBe('error')
  })

  it('uses only the first URI as the canonical root for every section', async () => {
    await using fixture = await setup({
      articles: [group([docUri, missingUri])],
      publications: [group([pubUri, 'bad'])],
      photos: [group([galleryUri, photoUri, null])],
      livestreams: [group([liveUri, missingUri])],
    })
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(hydrate).toHaveBeenCalledWith(
      [docUri, pubUri, galleryUri, liveUri],
      expect.objectContaining({ viewer: null }),
    )
    expect(hydrate.mock.calls.filter(([, , seen]) => !seen)).toHaveLength(1)
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      missingUri,
    )
    expect(body.articles).toHaveLength(1)
    expect(body.articles[0].featured).toBe(false)
    expect(body.publications).toHaveLength(1)
    expect(body.photos).toHaveLength(1)
    expect(body.photos[0].featured).toBe(false)
    expect(body.photos[0].view.associatedRefs?.map(({ uri }) => uri)).toEqual([
      galleryUri,
      itemUri,
      photoUri,
    ])
    expect(body.livestreams).toHaveLength(1)
  })

  test.each([
    { uris: [] },
    { uris: [null, docUri] },
    { uris: ['bad', docUri] },
    { uris: [missingUri, docUri] },
  ])(
    'does not fall back to another article URI when the first is absent or unavailable: $uris',
    async ({ uris }) => {
      await using fixture = await setup({ articles: [group(uris)] })
      using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
      const { status, body } = await fixture.query()

      expect(status).toBe(200)
      expect(body.articles).toEqual([])
      expect(
        lookup.mock.calls.flatMap(([params]) => params.uris),
      ).not.toContain(docUri)
    },
  )

  it('does not substitute a later URI with the correct section type', async () => {
    await using fixture = await setup({
      articles: [group([pubUri, docUri])],
      publications: [group([docUri, pubUri])],
      photos: [group([photoUri, galleryUri])],
      livestreams: [group([pubUri, liveUri])],
    })
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(hydrate).toHaveBeenCalledWith(
      [pubUri, docUri, photoUri],
      expect.objectContaining({ viewer: null }),
    )
    expect(body.articles).toEqual([])
    expect(body.publications).toEqual([])
    expect(body.photos).toEqual([])
    expect(body.livestreams).toEqual([])
  })

  test.each<app.bsky.unspecced.getAtmosphereExploreTab.$Params>([
    {},
    { langs: ['en', 'es'] },
    { countryCode: 'US' },
    { regionCode: 'WI' },
    { langs: ['en', 'es'], countryCode: 'US', regionCode: 'WI' },
    { countryCode: 'US&extra=value', regionCode: 'WI +/?#' },
  ])(
    'always fetches the full config regardless of request params: %j',
    async (params) => {
      await using fixture = await setup()
      expect(
        (
          await fixture.query(true, params, {
            'x-atproto-bsky-topics': 'news',
            'x-bsky-topics': 'news',
          })
        ).status,
      ).toBe(200)
      const request = fixture.fetchMock.mock.calls[0][0] as Request
      expect(request.url).toBe(service)
      expect(request.headers.get('authorization')).toBeNull()
      expect(request.headers.get('x-atproto-bsky-topics')).toBeNull()
      expect(request.headers.get('x-bsky-topics')).toBeNull()
    },
  )

  it('fetches the configured service URL as-is', async () => {
    await using fixture = await setup()
    fixture.cfg.atmosphereExploreTabService = `${service}?config=curated&countryCode=CA`
    expect(
      (await fixture.query(false, { countryCode: 'US', regionCode: 'WI' }))
        .status,
    ).toBe(200)
    const request = fixture.fetchMock.mock.calls[0][0] as Request
    expect(request.url).toBe(`${service}?config=curated&countryCode=CA`)
  })

  describe('announcement banner', () => {
    const now = Date.parse(publishedAt)
    const at = (offsetMs: number) => new Date(now + offsetMs).toISOString()
    const day = 24 * 60 * 60 * 1000
    const banner = (id: string, extra: object = {}) => ({
      id,
      status: 'enabled',
      ...extra,
    })
    const us = { countryCode: 'US', regionCode: 'WI' }

    async function pickBanner(
      banners: unknown,
      params: app.bsky.unspecced.getAtmosphereExploreTab.$Params = {},
    ) {
      using _now = vi.spyOn(Date, 'now').mockReturnValue(now)
      await using fixture = await setup({ announcementBanners: banners })
      const { status, body } = await fixture.query(false, params)
      expect(status).toBe(200)
      return body.announcementBanner?.id
    }

    test.each([undefined, [], [banner('off', { status: 'disabled' })]])(
      'omits the banner when none is eligible: %j',
      async (banners) => {
        expect(await pickBanner(banners)).toBeUndefined()
      },
    )

    it('returns only presentation fields', async () => {
      using _now = vi.spyOn(Date, 'now').mockReturnValue(now)
      const presentation = {
        id: 'full',
        title: 'Title',
        description: 'Description',
        url: 'https://example.com/url',
        image: 'https://example.com/image.jpg',
        overlayColor: '#000000',
        textColor: '#ffffff',
      }
      await using fixture = await setup({
        announcementBanners: [
          {
            ...presentation,
            status: 'enabled',
            startsAt: at(-day),
            endsAt: at(day),
            locations: [],
            tags: ['news'],
            extra: 'value',
          },
        ],
      })
      const { status, body } = await fixture.query()
      expect(status).toBe(200)
      expect(body.announcementBanner).toStrictEqual(presentation)
      // The fixture server validates responses against the lexicon too.
      expect(
        app.bsky.unspecced.getAtmosphereExploreTab.announcementBanner.$matches(
          body.announcementBanner,
        ),
      ).toBe(true)
    })

    it('ignores the legacy singular worker input', async () => {
      await using fixture = await setup({ announcementBanner: curatedBanner })
      expect((await fixture.query()).body.announcementBanner).toBeUndefined()
    })

    it('prefers an eligible matching-location banner over later-expiring unrestricted ones', async () => {
      const banners = [
        banner('open', { endsAt: at(30 * day) }),
        banner('none'),
        banner('first-match', { locations: ['US'], endsAt: at(day) }),
        banner('second-match', { locations: ['US-WI'] }),
      ]
      expect(await pickBanner(banners, us)).toBe('first-match')
      expect(await pickBanner(banners, { countryCode: 'JP' })).toBe('none')
    })

    it('does not let ineligible targeted banners override an eligible unrestricted one', async () => {
      expect(
        await pickBanner(
          [
            banner('future', { locations: ['US'], startsAt: at(1) }),
            banner('expired', { locations: ['US'], endsAt: at(0) }),
            banner('off', { locations: ['US'], status: 'disabled' }),
            banner('open', { endsAt: at(day) }),
          ],
          us,
        ),
      ).toBe('open')
    })

    it('falls back to the eligible unrestricted banner with the furthest endsAt', async () => {
      expect(
        await pickBanner([
          banner('soon', { endsAt: at(day) }),
          banner('latest', { endsAt: at(3 * day), locations: [] }),
          banner('mid', { endsAt: at(2 * day) }),
          banner('future-latest', { startsAt: at(1), endsAt: at(9 * day) }),
          banner('expired-latest', { startsAt: at(-day), endsAt: at(-1) }),
          banner('disabled-latest', {
            status: 'disabled',
            endsAt: at(9 * day),
          }),
          banner('wrong-place', { locations: ['JP'], endsAt: at(9 * day) }),
        ]),
      ).toBe('latest')
    })

    it('chooses furthest unrestricted banner when other targeted banners do not match', async () => {
      expect(
        await pickBanner(
          [
            banner('jp', { locations: ['JP'], endsAt: at(30 * day) }),
            banner('us-ca', { locations: ['US-CA'], endsAt: at(30 * day) }),
            banner('short', { endsAt: at(day) }),
            banner('long', { endsAt: at(2 * day) }),
          ],
          us,
        ),
      ).toBe('long')
    })

    it('breaks equal expirations by worker order and ranks no expiration furthest', async () => {
      expect(
        await pickBanner([
          banner('a', { endsAt: at(day) }),
          banner('b', { endsAt: at(day) }),
        ]),
      ).toBe('a')
      expect(
        await pickBanner([
          banner('finite', { endsAt: at(100 * day) }),
          banner('missing'),
          banner('null', { endsAt: null }),
        ]),
      ).toBe('missing')
    })

    test.each([
      { note: 'start inclusive', extra: { startsAt: at(0) }, eligible: true },
      { note: 'before start', extra: { startsAt: at(1) }, eligible: false },
      { note: 'end exclusive', extra: { endsAt: at(0) }, eligible: false },
      { note: 'before end', extra: { endsAt: at(1) }, eligible: true },
      {
        note: 'null bounds',
        extra: { startsAt: null, endsAt: null },
        eligible: true,
      },
      {
        note: 'reversed window',
        extra: { startsAt: at(day), endsAt: at(-day) },
        eligible: false,
      },
      {
        note: 'empty window',
        extra: { startsAt: at(0), endsAt: at(0) },
        eligible: false,
      },
    ])('applies the scheduling window: $note', async ({ extra, eligible }) => {
      expect(await pickBanner([banner('b', extra)])).toBe(
        eligible ? 'b' : undefined,
      )
    })

    test.each([
      { locations: ['US'], params: { countryCode: 'US' }, match: true },
      { locations: ['US'], params: us, match: true },
      { locations: ['US-WI'], params: us, match: true },
      {
        locations: ['US-WI'],
        params: { countryCode: 'US', regionCode: 'US-WI' },
        match: true,
      },
      { locations: ['US-WI'], params: { countryCode: 'US' }, match: false },
      {
        locations: ['US-WI'],
        params: { countryCode: 'US', regionCode: 'CA' },
        match: false,
      },
      {
        locations: ['US-WI'],
        params: { countryCode: 'CA', regionCode: 'WI' },
        match: false,
      },
      { locations: ['US'], params: { regionCode: 'WI' }, match: false },
      { locations: ['JP'], params: {}, match: false },
      { locations: ['JP'], params: us, match: false },
    ])(
      'location $locations with $params matches: $match',
      async ({ locations, params, match }) => {
        // A wrong-location banner never leaks through, even as the only banner.
        expect(await pickBanner([banner('t', { locations })], params)).toBe(
          match ? 't' : undefined,
        )
      },
    )

    test.each([{}, { locations: [] }])(
      'treats missing or empty locations as unrestricted: %j',
      async (extra) => {
        expect(await pickBanner([banner('open', extra)], {})).toBe('open')
        expect(await pickBanner([banner('open', extra)], us)).toBe('open')
      },
    )
  })

  it('accepts worker-shaped groups; schedules, not raw featured, decide the flag', async () => {
    const metadata = { canonicalUri: null, startsAt: null, endsAt: null }
    await using fixture = await setup({
      ...curated,
      articles: [
        { uris: [docUri], ...metadata },
        { uris: [docUri], featured: true, tags: [], locations: [] },
        { uris: [docUri], featured: false, tags: ['general'], ...metadata },
      ],
      publications: [{ uris: [pubUri], ...metadata }],
      photos: [{ uris: [galleryUri], tags: ['general'] }],
      livestreams: [{ uris: [liveUri], locations: [] }],
    })
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    // Null schedules are not featured; a worker-supplied `featured` is ignored.
    expect(body.articles.map(({ featured }) => featured)).toEqual([
      false,
      false,
      false,
    ])
    expect(body.publications.map(({ featured }) => featured)).toEqual([false])
    expect(body.photos.map(({ featured }) => featured)).toEqual([false])
    expect(body.livestreams.map(({ featured }) => featured)).toEqual([false])
    expect(body.announcementBanner).toEqual(curatedBanner)
    expect(body.apps).toEqual(curated.apps)
    for (const key of lists.map(({ key }) => key))
      for (const item of body[key])
        expect(Object.keys(item).sort()).toEqual(['featured', 'view'])
  })

  describe('scheduled featured flags', () => {
    const day = 24 * 60 * 60 * 1000
    const windows = [
      {
        note: 'active',
        schedule: { startsAt: at(-1), endsAt: at(1) },
        featured: true,
      },
      {
        note: 'start inclusive',
        schedule: { startsAt: at(0), endsAt: at(day) },
        featured: true,
      },
      {
        note: 'end exclusive',
        schedule: { startsAt: at(-day), endsAt: at(0) },
        featured: false,
      },
      {
        note: 'future',
        schedule: { startsAt: at(1), endsAt: at(day) },
        featured: false,
      },
      {
        note: 'expired',
        schedule: { startsAt: at(-day), endsAt: at(-1) },
        featured: false,
      },
      { note: 'no dates', schedule: {}, featured: false },
      {
        note: 'null dates',
        schedule: { startsAt: null, endsAt: null },
        featured: false,
      },
      { note: 'missing end', schedule: { startsAt: at(-1) }, featured: false },
      {
        note: 'null end',
        schedule: { startsAt: at(-1), endsAt: null },
        featured: false,
      },
      { note: 'missing start', schedule: { endsAt: at(1) }, featured: false },
      {
        note: 'null start',
        schedule: { startsAt: null, endsAt: at(1) },
        featured: false,
      },
      {
        note: 'reversed',
        schedule: { startsAt: at(day), endsAt: at(-day) },
        featured: false,
      },
      {
        note: 'equal bounds',
        schedule: { startsAt: at(0), endsAt: at(0) },
        featured: false,
      },
    ]

    test.each(windows)(
      'computes featured from the window in every list, ignoring raw featured: $note',
      async ({ schedule, featured }) => {
        using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
        const withRaw = (uri: AtUriString, raw: boolean) => ({
          uris: [uri],
          ...schedule,
          featured: raw,
        })
        for (const raw of [true, false]) {
          await using fixture = await setup({
            articles: [withRaw(docUri, raw)],
            publications: [withRaw(pubUri, raw)],
            photos: [withRaw(galleryUri, raw)],
            livestreams: [withRaw(liveUri, raw)],
          })
          const { status, body } = await fixture.query()
          expect(status).toBe(200)
          for (const { key } of lists) {
            expect(body[key].map((item) => item.featured)).toEqual([featured])
            expect(Object.keys(body[key][0]).sort()).toEqual([
              'featured',
              'view',
            ])
          }
        }
      },
    )

    it('keeps distinct entries for one root with per-entry flags', async () => {
      using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
      await using fixture = await setup({
        articles: [
          { uris: [docUri] },
          { uris: [docUri], startsAt: at(-1), endsAt: at(1) },
          { uris: [docUri], startsAt: at(1), endsAt: at(2) },
        ],
      })
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      const { body } = await fixture.query()
      expect(hydrate.mock.calls[0][0]).toEqual([docUri])
      expect(body.articles.map(({ featured }) => featured)).toEqual([
        true,
        false,
        false,
      ])
    })

    test.each([
      { articles: [{ uris: [docUri], startsAt: 1 }] },
      { articles: [{ uris: [docUri], endsAt: true }] },
      { publications: [{ uris: [pubUri], startsAt: 'tomorrow' }] },
      { photos: [{ uris: [galleryUri], endsAt: '2026-10-01' }] },
      {
        livestreams: [
          { uris: [liveUri] },
          { uris: [liveUri], startsAt: 'soon' },
        ],
      },
      // Invalid even when the entry is excluded or beyond the selection cap.
      {
        articles: [{ uris: [docUri], locations: ['JP'], endsAt: 'bad' }],
      },
      {
        articles: [
          ...Array.from({ length: 10 }, () => ({ uris: [docUri] })),
          { uris: [docUri], startsAt: 'bad' },
        ],
      },
    ])('rejects malformed content schedules %#', async (config) => {
      await using fixture = await setup(config)
      using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
      expect((await fixture.query()).status).toBe(502)
      expect(lookup).not.toHaveBeenCalled()
    })
  })

  describe('selection before hydration', () => {
    const topics = { 'x-atproto-bsky-topics': ' news , ,news,sports' }
    const us = { countryCode: 'US', regionCode: 'WI' }

    async function selectedRoots(
      key: ListKey,
      entries: unknown[],
      params: app.bsky.unspecced.getAtmosphereExploreTab.$Params = {},
      headers: Record<string, string> = {},
    ) {
      using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
      await using fixture = await setup({ [key]: entries })
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      expect((await fixture.query(false, params, headers)).status).toBe(200)
      return (
        hydrate.mock.calls.find(([, , seen]) => !seen)?.[0] ??
        ([] as AtUriString[])
      )
    }

    test.each(lists)(
      'orders $key by location, topic, general, then untagged, stably',
      async ({ key, uriFor }) => {
        const u = (name: string) => uriFor(name)
        const entry = (name: string, extra: object) => ({
          uris: [u(name)],
          ...extra,
        })
        const entries = [
          entry('untagged', {}),
          entry('empty', { tags: [] }),
          entry('general', { tags: ['general'] }),
          entry('topic', { tags: ['news'], locations: [] }),
          entry('country', { tags: ['other'], locations: ['US'] }),
          entry('unrelated', { tags: ['other'] }),
          entry('multi-topic', { tags: ['general', 'sports', 'news'] }),
          entry('region', { locations: ['US-WI'] }),
          entry('wrong-topic', { tags: ['news'], locations: ['JP'] }),
          entry('wrong-general', { tags: ['general'], locations: ['JP'] }),
          entry('wrong-untagged', { locations: ['JP'] }),
          entry('wrong-region', { locations: ['US-CA'] }),
          entry('multi-location', {
            tags: ['news', 'general'],
            locations: ['JP', 'US'],
          }),
        ]
        expect(await selectedRoots(key, entries, us, topics)).toEqual(
          [
            'country',
            'region',
            'multi-location',
            'topic',
            'multi-topic',
            'general',
            'untagged',
            'empty',
          ].map(u),
        )
      },
    )

    test.each(lists)(
      'selects at most 10 $key before hydration without backfilling',
      async ({ key, uriFor }) => {
        const roots = Array.from({ length: 12 }, (_, i) => uriFor(`root-${i}`))
        // General entries fill the cap; a later location match outranks them.
        const entries = [
          ...roots
            .slice(0, 11)
            .map((uri) => ({ uris: [uri], tags: ['general'] })),
          { uris: [roots[11]], locations: ['US'] },
        ]
        await using fixture = await setup({ [key]: entries })
        using hydrate = vi.spyOn(
          fixture.hydrator,
          'hydrateEmbedExternalViewFromUris',
        )
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        expect((await fixture.query(false, us)).status).toBe(200)
        const selected = [roots[11], ...roots.slice(0, 9)]
        expect(hydrate.mock.calls.filter(([, , seen]) => !seen)).toHaveLength(1)
        expect(hydrate.mock.calls[0][0]).toEqual(selected)
        expect(lookup.mock.calls[0][0].uris).toEqual(selected)
        const looked = lookup.mock.calls.flatMap(([params]) => params.uris)
        expect(looked).not.toContain(roots[9])
        expect(looked).not.toContain(roots[10])
      },
    )

    test.each(lists)(
      'lets a selected unavailable $key root consume its slot',
      async ({ key, uriFor, baseUri }) => {
        const missing = Array.from({ length: 10 }, (_, i) =>
          uriFor(`missing-${i}`),
        )
        await using fixture = await setup({
          [key]: [
            ...missing.map((uri) => ({ uris: [uri] })),
            { uris: [baseUri] },
          ],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key]).toEqual([])
        expect(lookup.mock.calls[0][0].uris).toEqual(missing)
        expect(
          lookup.mock.calls.flatMap(([params]) => params.uris),
        ).not.toContain(baseUri)
      },
    )

    test.each(lists)(
      'renders a selected $key entry and keeps repeated worker entries',
      async ({ key, baseUri }) => {
        await using fixture = await setup({
          [key]: [
            { uris: [baseUri], tags: ['news'] },
            { uris: [baseUri], tags: ['other'] },
            { uris: [baseUri], tags: ['general'] },
            { uris: [baseUri] },
          ],
        })
        using hydrate = vi.spyOn(
          fixture.hydrator,
          'hydrateEmbedExternalViewFromUris',
        )
        const { body } = await fixture.query(false, {}, topics)
        expect(hydrate.mock.calls[0][0]).toEqual([baseUri])
        expect(body[key]).toHaveLength(3)
      },
    )

    test.each<{
      note: string
      headers: Record<string, string>
      expected: string[]
    }>([
      {
        note: 'missing header',
        headers: {},
        expected: ['general', 'untagged'],
      },
      {
        note: 'empty header',
        headers: { 'x-atproto-bsky-topics': ' , ,' },
        expected: ['general', 'untagged'],
      },
      {
        note: 'deprecated header only',
        headers: { 'x-bsky-topics': 'news' },
        expected: ['general', 'untagged'],
      },
      {
        note: 'exact, case-sensitive matches',
        headers: { 'x-atproto-bsky-topics': 'news' },
        expected: ['news', 'general', 'untagged'],
      },
      {
        note: 'trimmed and repeated tokens',
        headers: { 'x-atproto-bsky-topics': '\tNews ,, news ,news' },
        expected: ['news', 'News', 'general', 'untagged'],
      },
      {
        note: 'general as a requested topic',
        headers: { 'x-atproto-bsky-topics': 'general' },
        expected: ['general', 'untagged'],
      },
    ])('matches request topics: $note', async ({ headers, expected }) => {
      const entries = [
        { uris: [liveUri], tags: [] },
        { uris: [docUri], tags: ['general'] },
        { uris: [pubUri], tags: ['news-today'] },
        { uris: [galleryUri], tags: ['Newsletter'] },
        { uris: [itemUri], tags: ['New'] },
        { uris: [photoUri], tags: ['news'] },
        { uris: [missingUri], tags: ['News'] },
      ]
      const names = new Map<AtUriString, string>([
        [liveUri, 'untagged'],
        [docUri, 'general'],
        [photoUri, 'news'],
        [missingUri, 'News'],
      ])
      const roots = await selectedRoots('articles', entries, {}, headers)
      expect(roots.map((uri) => names.get(uri))).toEqual(expected)
    })

    test.each([
      { locations: ['US'], params: { countryCode: 'US' }, match: true },
      {
        locations: ['us'],
        params: { countryCode: 'us', regionCode: 'wi' },
        match: true,
      },
      { locations: ['US'], params: us, match: true },
      { locations: ['US-WI'], params: us, match: true },
      {
        locations: ['US-WI'],
        params: { countryCode: 'US', regionCode: 'US-WI' },
        match: true,
      },
      { locations: ['JP', 'US-WI'], params: us, match: true },
      {
        locations: ['US'],
        params: { countryCode: 'US', regionCode: 'CA-ON' },
        match: true,
      },
      {
        locations: ['US-WI'],
        params: { countryCode: 'US', regionCode: 'CA-WI' },
        match: false,
      },
      {
        locations: ['US-WI'],
        params: { countryCode: 'US', regionCode: 'US-CA' },
        match: false,
      },
      { locations: ['US-WI'], params: { countryCode: 'US' }, match: false },
      {
        locations: ['US-WI'],
        params: { countryCode: 'CA', regionCode: 'WI' },
        match: false,
      },
      { locations: ['US-WI'], params: { regionCode: 'WI' }, match: false },
      { locations: ['US-WI'], params: { regionCode: 'US-WI' }, match: false },
      { locations: ['US'], params: { regionCode: 'WI' }, match: false },
      {
        locations: ['US-'],
        params: { countryCode: 'US', regionCode: '' },
        match: false,
      },
      { locations: ['WI'], params: us, match: false },
      { locations: ['JP'], params: us, match: false },
      { locations: ['JP'], params: {}, match: false },
      {
        locations: ['JP-13'],
        params: { countryCode: 'US', regionCode: '13' },
        match: false,
      },
    ])(
      'location $locations with $params matches: $match',
      async ({ locations, params, match }) => {
        for (const key of lists.map((list) => list.key)) {
          const uri = lists.find((list) => list.key === key)!.uriFor('x')
          // Tags that would otherwise qualify never override a location miss.
          const entries = [
            { uris: [uri], locations, tags: ['news'] },
            { uris: [uri], locations, tags: ['general'] },
            { uris: [uri], locations },
            { uris: [uri], locations, tags: [] },
          ]
          expect(await selectedRoots(key, entries, params, topics)).toEqual(
            match ? [uri] : [],
          )
        }
      },
    )

    it('treats missing or empty locations as unrestricted, not as a location match', async () => {
      const entries = [
        { uris: [pubUri], locations: [] },
        { uris: [docUri], tags: ['general'], locations: [] },
        { uris: [liveUri], tags: ['news'] },
        { uris: [galleryUri], locations: ['US'] },
      ]
      expect(await selectedRoots('articles', entries, us, topics)).toEqual([
        galleryUri,
        liveUri,
        docUri,
        pubUri,
      ])
      expect(await selectedRoots('articles', entries, {}, topics)).toEqual([
        liveUri,
        docUri,
        pubUri,
      ])
    })

    it('selects each list independently', async () => {
      await using fixture = await setup({
        articles: Array.from({ length: 11 }, (_, i) => ({
          uris: [atUri(author, site.standard.document.$type, `a${i}`)],
        })),
        publications: [{ uris: [pubUri], locations: ['JP'] }],
        photos: [{ uris: [galleryUri] }],
        livestreams: [{ uris: [liveUri], tags: ['other'] }],
      })
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      const { body } = await fixture.query(false, us)
      expect(hydrate.mock.calls[0][0]).toEqual([
        ...Array.from({ length: 10 }, (_, i) =>
          atUri(author, site.standard.document.$type, `a${i}`),
        ),
        galleryUri,
      ])
      expect(body.publications).toEqual([])
      expect(body.photos).toHaveLength(1)
      expect(body.livestreams).toEqual([])
    })

    const active = { startsAt: at(-1), endsAt: at(1) }
    const expired = { startsAt: at(-2), endsAt: at(-1) }

    test.each(lists)(
      'places featured $key entries first, then bucket order, before the cap',
      async ({ key, uriFor }) => {
        const u = (name: string) => uriFor(name)
        const entry = (name: string, extra: object) => ({
          uris: [u(name)],
          ...extra,
        })
        const entries = [
          entry('o-untagged', {}),
          entry('o-location', { locations: ['US'] }),
          entry('f-untagged', active),
          entry('f-general', { tags: ['general'], ...active }),
          entry('f-location', { locations: ['US-WI'], ...active }),
          entry('o-topic', { tags: ['news'] }),
          entry('f-wrong-location', {
            tags: ['news'],
            locations: ['JP'],
            ...active,
          }),
          entry('f-wrong-location-untagged', { locations: ['JP'], ...active }),
          entry('f-unrelated', { tags: ['other'], ...active }),
          entry('o-expired-topic', { tags: ['news'], ...expired }),
          entry('f-topic', { tags: ['sports'], ...active }),
        ]
        expect(await selectedRoots(key, entries, us, topics)).toEqual(
          [
            'f-location',
            'f-topic',
            'f-general',
            'f-untagged',
            'o-location',
            'o-topic',
            'o-expired-topic',
            'o-untagged',
          ].map(u),
        )
      },
    )

    test.each(lists)(
      'lets a later featured $key entry displace an ordinary one before hydration',
      async ({ key, uriFor }) => {
        const roots = Array.from({ length: 11 }, (_, i) => uriFor(`root-${i}`))
        const entries = [
          ...roots.slice(0, 10).map((uri) => ({ uris: [uri] })),
          { uris: [roots[10]], ...active },
        ]
        expect(await selectedRoots(key, entries)).toEqual([
          roots[10],
          ...roots.slice(0, 9),
        ])
      },
    )

    test.each(lists)(
      'does not backfill when featured $key roots are unavailable',
      async ({ key, uriFor, baseUri }) => {
        using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
        const missing = Array.from({ length: 10 }, (_, i) =>
          uriFor(`missing-${i}`),
        )
        await using fixture = await setup({
          [key]: [
            { uris: [baseUri] },
            ...missing.map((uri) => ({ uris: [uri], ...active })),
          ],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key]).toEqual([])
        expect(lookup.mock.calls[0][0].uris).toEqual(missing)
        expect(
          lookup.mock.calls.flatMap(([params]) => params.uris),
        ).not.toContain(baseUri)
      },
    )
  })

  it('uses viewer-specific profile state only on authenticated requests', async () => {
    await using fixture = await setup(curated)
    using relationships = vi.spyOn(fixture.dataplane, 'getRelationships')
    const anonymous = await fixture.query()
    expect(
      anonymous.body.articles[0].view.associatedProfiles?.[0].viewer,
    ).toBeUndefined()
    expect(relationships).not.toHaveBeenCalled()
    const authenticated = await fixture.query(true)
    expect(authenticated.status).toBe(200)
    expect(
      authenticated.body.articles[0].view.associatedProfiles?.[0].viewer
        ?.following,
    ).toBe(atUri(viewer, app.bsky.graph.follow.$type, 'follow'))
    expect(relationships.mock.calls[0][0].actorDid).toBe(viewer)
    expect(
      (fixture.fetchMock.mock.calls[1][0] as Request).headers.get(
        'authorization',
      ),
    ).toBeNull()
  })

  it('omits articles with unavailable publication dependencies', async () => {
    await using fixture = await setup({
      articles: [group([docUri])],
    })
    fixture.takenDown.add(pubUri)
    expect((await fixture.query()).body.articles).toEqual([])
    fixture.takenDown.clear()
    fixture.records.set(
      docUri,
      site.standard.document.$build({
        title: 'Wrong site',
        site: atUri(author, site.standard.publication.$type, 'other'),
        publishedAt,
      }),
    )
    expect((await fixture.query()).body.articles).toEqual([])
  })

  test.each([
    { note: 'automatically discovered', publications: [] },
    { note: 'explicitly in another group', publications: [group([pubUri])] },
  ])(
    'renders a canonical document root with its publication $note',
    async ({ publications }) => {
      await using fixture = await setup({
        articles: [group([docUri])],
        publications,
      })
      using dependencies = vi.spyOn(
        fixture.hydrator,
        'hydrateExternalViewDependencies',
      )
      const { status, body } = await fixture.query()

      expect(status).toBe(200)
      expect(
        dependencies.mock.calls.some(
          ([state]) => state.externalRecords?.get(pubUri)?.record,
        ),
      ).toBe(true)
      expect(body.articles).toHaveLength(1)
      expect(body.articles[0].view).toMatchObject({
        title: 'Article',
        uri: 'https://example.com/blog/story',
        publisher: { title: 'Publication', subscriptionCount: 4 },
      })
      expect(
        body.articles[0].view.associatedRefs?.map(({ uri }) => uri),
      ).toEqual([docUri, pubUri])
      expect(body.publications).toHaveLength(publications.length)
    },
  )

  test.each(['record', 'label', 'actor', 'block'] as const)(
    'omits moderated content: %s',
    async (kind) => {
      await using fixture = await setup(curated)
      if (kind === 'record') fixture.takenDown.add(docUri)
      if (kind === 'label')
        fixture.labels.push({
          src: labeler,
          uri: docUri,
          val: '!takedown',
          cts: publishedAt,
        })
      if (kind === 'actor') fixture.takenDownActors.add(author)
      if (kind === 'block') fixture.blockedActors.add(author)
      const { status, body } = await fixture.query(true)
      expect(status).toBe(200)
      expect(body.articles).toEqual([])
    },
  )

  it('hydrates URI-only gallery items without applying position defaults', async () => {
    await using fixture = await setup(curated)
    fixture.records.set(
      itemUri,
      grainGalleryItem.$build({
        gallery: galleryUri,
        item: photoUri,
        createdAt: publishedAt,
      }),
    )
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    expect((await fixture.query()).body.photos).toHaveLength(1)
    expect(lookup).toHaveBeenCalledWith({ uris: [photoUri] })
    expect(fixture.records.get(itemUri)).not.toHaveProperty('position')
    fixture.takenDown.add(photoUri)
    expect((await fixture.query()).body.photos).toEqual([])
  })

  it('preserves gallery position ordering through nested hydration in mixed input', async () => {
    await using fixture = await setup(curated)
    const item2Uri = atUri(author, grainGalleryItem.$type, 'item2')
    const photo2Uri = atUri(author, grainPhoto.$type, 'photo2')
    fixture.records.set(itemUri, {
      ...fixture.records.get(itemUri)!,
      position: 1,
    })
    fixture.records.set(
      item2Uri,
      grainGalleryItem.$build({
        gallery: galleryUri,
        item: photo2Uri,
        position: 0,
        createdAt: publishedAt,
      }),
    )
    fixture.records.set(photo2Uri, {
      ...fixture.records.get(photoUri)!,
      alt: 'Earlier photo',
    })
    using backlinks = vi
      .spyOn(fixture.dataplane, 'getAtmosphereBacklinks')
      .mockImplementation(
        async ({ collection, targetUri }) =>
          new GetAtmosphereBacklinksResponse({
            backlinks:
              collection === grainGalleryItem.$type && targetUri === galleryUri
                ? [{ uri: itemUri }, { uri: item2Uri }]
                : [],
          }),
      )

    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(body.articles).toHaveLength(2)
    expect(body.publications).toHaveLength(1)
    expect(body.livestreams).toHaveLength(1)
    expect(
      body.photos[0].view.items.map(
        (item) =>
          app.bsky.embed.external.viewGalleryImage.$ifMatches(item)?.alt,
      ),
    ).toEqual(['Earlier photo', 'A photo'])
    expect(body.photos[0].view.associatedRefs?.map(({ uri }) => uri)).toEqual([
      galleryUri,
      item2Uri,
      photo2Uri,
      itemUri,
      photoUri,
    ])
    expect(backlinks).toHaveBeenCalledWith({
      targetUri: galleryUri,
      collection: grainGalleryItem.$type,
      limit: 10,
    })
  })

  it('rejects gallery item shapes outside the canonical lexicon', async () => {
    await using fixture = await setup(curated)
    fixture.records.set(itemUri, {
      ...fixture.records.get(itemUri)!,
      item: { uri: photoUri, cid },
    })
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    expect((await fixture.query()).body.photos).toEqual([])
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      photoUri,
    )
  })

  it('keeps loose documents, but skips invalid URI groups and invalid records', async () => {
    await using fixture = await setup({
      articles: [
        group([docUri]),
        group(['bad', docUri]),
        group([null, docUri]),
      ],
    })
    fixture.records.set(
      docUri,
      site.standard.document.$build({
        title: 'Loose',
        site: 'https://example.com',
        path: '/loose',
        publishedAt,
      }),
    )
    const { body } = await fixture.query()
    expect(body.articles).toHaveLength(1)
    expect(body.articles[0].view.uri).toBe('https://example.com/loose')
    expect(body.articles[0].view.publisher).toBeUndefined()
    fixture.records.set(docUri, {
      $type: site.standard.document.$type,
      title: 42,
      site: pubUri,
    })
    expect((await fixture.query()).body.articles).toEqual([])
  })

  it('uses bounded, deduplicated profile previews', async () => {
    await using fixture = await setup({ articles: [group([docUri])] })
    using backlinks = vi
      .spyOn(fixture.dataplane, 'getAtmosphereBacklinks')
      .mockResolvedValue(
        new GetAtmosphereBacklinksResponse({
          backlinks: [
            {
              uri: atUri(
                'did:plc:z',
                site.standard.graph.recommend.$type,
                'one',
              ),
            },
            {
              uri: atUri(
                'did:plc:a',
                site.standard.graph.recommend.$type,
                'one',
              ),
            },
            {
              uri: atUri(
                'did:plc:a',
                site.standard.graph.recommend.$type,
                'two',
              ),
            },
          ],
        }),
      )
    for (const [did, rkey] of [
      ['did:plc:z', 'one'],
      ['did:plc:a', 'one'],
      ['did:plc:a', 'two'],
    ] as const) {
      fixture.records.set(
        atUri(did, site.standard.graph.recommend.$type, rkey),
        site.standard.graph.recommend.$build({
          document: docUri,
          createdAt: publishedAt,
        }),
      )
    }
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { body } = await fixture.query()
    expect(lookup).toHaveBeenCalledWith({
      uris: [
        pubUri,
        atUri('did:plc:z', site.standard.graph.recommend.$type, 'one'),
        atUri('did:plc:a', site.standard.graph.recommend.$type, 'one'),
        atUri('did:plc:a', site.standard.graph.recommend.$type, 'two'),
      ],
    })
    expect(body.articles[0].view.likers?.map(({ did }) => did)).toEqual([
      'did:plc:a',
      'did:plc:z',
    ])
    expect(backlinks.mock.calls.every(([params]) => params.limit === 3)).toBe(
      true,
    )
    for (const [uri, record] of fixture.records) {
      if (site.standard.graph.recommend.$isTypeOf(record)) {
        fixture.takenDown.add(uri)
      }
    }
    const moderated = (await fixture.query()).body.articles[0].view
    expect(moderated.likers).toEqual([])
    expect(moderated.likeCount).toBe(7)
  })

  it('rejects gallery items associated with a different gallery', async () => {
    await using fixture = await setup(curated)
    fixture.records.set(
      itemUri,
      grainGalleryItem.$build({
        gallery: atUri(author, grainGallery.$type, 'other'),
        item: photoUri,
        position: 0,
        createdAt: publishedAt,
      }),
    )
    expect((await fixture.query()).body.photos).toEqual([])
  })

  it('returns ended livestreams with their end timestamp', async () => {
    await using fixture = await setup(curated)
    fixture.records.set(
      liveUri,
      streamLivestream.$build({
        title: 'Ended',
        url: 'https://stream.place/author',
        createdAt: publishedAt,
        endedAt: publishedAt,
      }),
    )
    expect((await fixture.query()).body.livestreams[0].view).toMatchObject({
      active: false,
      endedAt: publishedAt,
    })
  })

  test.each([
    { lastSeenAt: undefined, active: false },
    {
      lastSeenAt: toDatetimeString(Date.parse(publishedAt) - 3 * 60_000),
      active: false,
    },
    { lastSeenAt: publishedAt, active: true },
  ] as const)(
    'uses shared livestream heartbeat semantics: $lastSeenAt',
    async ({ lastSeenAt, active }) => {
      using now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(publishedAt))
      await using fixture = await setup({ livestreams: [group([liveUri])] })
      fixture.records.set(
        liveUri,
        streamLivestream.$build({
          title: 'Stream',
          createdAt: publishedAt,
          lastSeenAt,
        }),
      )
      expect((await fixture.query()).body.livestreams[0].view).toMatchObject({
        uri: liveUri,
        active,
      })
      expect(now).toHaveBeenCalled()
    },
  )

  it('returns empty sections for absent config sections', async () => {
    await using fixture = await setup()
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    expect(await fixture.query()).toEqual({
      status: 200,
      body: {
        articles: [],
        publications: [],
        photos: [],
        livestreams: [],
        apps: [],
      },
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  test.each([
    null,
    { articles: [group([docUri]), { uris: 'not-an-array' }] },
    { articles: [{ uris: [docUri], tags: 'general' }] },
    { articles: [{ uris: [docUri], tags: [1] }] },
    { articles: [{ uris: [docUri], tags: ['x'.repeat(129)] }] },
    {
      articles: [
        { uris: [docUri], tags: Array.from({ length: 101 }, () => 'a') },
      ],
    },
    { articles: [{ uris: [docUri], locations: 'US' }] },
    { articles: [{ uris: [docUri], locations: [null] }] },
    { articles: [{ uris: [docUri], locations: ['U'.repeat(17)] }] },
    {
      photos: [
        {
          uris: [galleryUri],
          locations: Array.from({ length: 101 }, () => 'US'),
        },
      ],
    },
    { livestreams: [{ uris: [liveUri], tags: null }] },
    // Slicing to the selection limit must not bypass the input URI cap.
    {
      publications: Array.from({ length: 12 }, () =>
        group(Array.from({ length: 50 }, () => pubUri)),
      ),
    },
    { announcementBanners: [{ status: 'enabled', title: 123 }] },
    { announcementBanners: [{ status: 'enabled', url: 'not a uri' }] },
    { announcementBanners: [{ title: 'No status' }] },
    { announcementBanners: [{ status: 1 }] },
    { announcementBanners: [{ status: 'x'.repeat(129) }] },
    { announcementBanners: [{ status: 'enabled', startsAt: 'tomorrow' }] },
    { announcementBanners: [{ status: 'enabled', endsAt: 1 }] },
    { announcementBanners: [{ status: 'enabled', locations: 'US' }] },
    { announcementBanners: [{ status: 'enabled', locations: [1] }] },
    {
      announcementBanners: [{ status: 'enabled', locations: ['U'.repeat(17)] }],
    },
    { announcementBanners: 'banner' },
    {
      announcementBanners: Array.from({ length: 101 }, () => ({
        status: 'enabled',
      })),
    },
    // An invalid later banner fails the config even after an eligible first.
    {
      announcementBanners: [
        { status: 'enabled', title: 'First' },
        { status: 'disabled', title: 123 },
      ],
    },
    { apps: [{ url: 123 }] },
    { articles: Array.from({ length: 101 }, () => group([docUri])) },
    { photos: [group(Array.from({ length: 101 }, () => photoUri))] },
    {
      articles: Array.from({ length: 6 }, () =>
        group(Array.from({ length: 100 }, () => docUri)),
      ),
    },
  ])('rejects malformed or excessive config %#', async (config) => {
    await using fixture = await setup(config)
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    expect((await fixture.query()).status).toBe(502)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('rejects oversized decoded bodies even without Content-Length', async () => {
    await using fixture = await setup()
    fixture.fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ padding: 'x'.repeat(512 * 1024) })),
    )
    expect((await fixture.query()).status).toBe(502)
  })

  test.each(['http', 'json', 'network', 'timeout'] as const)(
    'maps upstream failures: %s',
    async (failure) => {
      await using fixture = await setup()
      fixture.fetchMock.mockImplementation(async () => {
        if (failure === 'http') return new Response('', { status: 503 })
        if (failure === 'json') return new Response('{')
        if (failure === 'timeout')
          throw new DOMException('Timed out', 'TimeoutError')
        throw new TypeError('Network failure')
      })
      expect((await fixture.query()).status).toBe(
        failure === 'timeout' ? 504 : 502,
      )
    },
  )

  it('is unavailable without the configured service URL', async () => {
    await using fixture = await setup()
    fixture.cfg.atmosphereExploreTabService = undefined
    expect((await fixture.query()).status).toBe(501)
    expect(fixture.fetchMock).not.toHaveBeenCalled()
  })

  it('reads the service URL from BSKY_ATMOSPHERE_EXPLORE_TAB_SERVICE', () => {
    vi.stubEnv('BSKY_ATMOSPHERE_EXPLORE_TAB_SERVICE', service)
    vi.stubEnv('BSKY_BSYNC_URL', 'http://localhost:3000')
    vi.stubEnv('MOD_SERVICE_DID', labeler)
    try {
      expect(
        ServerConfig.readEnv({ dataplaneUrls: ['http://localhost:3001'] })
          .atmosphereExploreTabService,
      ).toBe(service)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
