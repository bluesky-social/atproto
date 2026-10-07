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
const group = (uris: unknown[], featured = false) => ({ uris, featured })
const service = 'https://cms.bsky.app/atmosphere-explore-tab'

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
    cfg,
    fetchMock,
    query: async (
      authenticated = false,
      params: app.bsky.unspecced.getAtmosphereExploreTab.$Params = {},
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
        headers: authenticated ? { authorization: 'Bearer valid' } : {},
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

const curated = {
  announcementBanner: {
    id: 'banner',
    title: 'Explore',
    image: 'https://example.com/banner.jpg',
  },
  articles: [
    group([missingUri], true),
    group([docUri, pubUri], true),
    group([docUri]),
    group([pubUri, docUri]),
  ],
  publications: [group([pubUri])],
  photos: [group([photoUri, galleryUri], true)],
  livestreams: [group([liveUri])],
  apps: [{ id: 'app', title: 'An app', url: 'https://example.com/app' }],
}

describe('Atmosphere Explore', () => {
  it('hydrates canonical views, associations, ordering, and featured flags', async () => {
    await using fixture = await setup(curated)
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(body.announcementBanner).toEqual(curated.announcementBanner)
    expect(body.apps).toEqual(curated.apps)
    expect(body.articles.map(({ featured }) => featured)).toEqual([true, false])
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

  test.each<app.bsky.unspecced.getAtmosphereExploreTab.$Params>([
    {},
    { langs: ['en', 'es'] },
    { countryCode: 'US' },
    { regionCode: 'WI' },
    { langs: ['en', 'es'], countryCode: 'US', regionCode: 'WI' },
    { countryCode: 'US&extra=value', regionCode: 'WI +/?#' },
  ])('forwards only the supplied location params: %j', async (params) => {
    await using fixture = await setup()
    expect((await fixture.query(false, params)).status).toBe(200)
    const request = fixture.fetchMock.mock.calls[0][0] as Request
    expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual(
      Object.fromEntries(
        Object.entries(params).filter(([key]) => key !== 'langs'),
      ),
    )
  })

  it('preserves configured query params and replaces location params without duplicating them', async () => {
    await using fixture = await setup()
    fixture.cfg.atmosphereExploreTabService = `${service}?config=curated&countryCode=CA&regionCode=ON`
    expect(
      (await fixture.query(false, { countryCode: 'US', regionCode: 'WI' }))
        .status,
    ).toBe(200)
    const request = fixture.fetchMock.mock.calls[0][0] as Request
    expect(request.url).toBe(
      `${service}?config=curated&countryCode=US&regionCode=WI`,
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

  it('omits unavailable or mismatched associations instead of borrowing another group', async () => {
    await using fixture = await setup({
      articles: [group([docUri]), group([docUri, pubUri])],
      publications: [group([pubUri])],
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
        group([docUri], true),
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
    await using fixture = await setup({ articles: [group([docUri, pubUri])] })
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
    { articles: [group([docUri], true), { uris: [pubUri] }] },
    { announcementBanner: { title: 123 } },
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
