import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import {
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import {
  type AtUriString,
  Client,
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
import { Gate } from '../src/feature-gates/gates.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, type com, place, site, social } from '../src/lexicons/index.js'
import { httpLogger } from '../src/logger.js'
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
const doc2Uri = atUri(author, site.standard.document.$type, 'story2')
const missingUri = atUri(author, site.standard.document.$type, 'missing')
const group = (canonicalUri: unknown) => ({ canonicalUri })
const service = 'https://cms.bsky.app/atmosphere-explore-tab'
// The dataplane rejects larger record lookups; the fixture does too.
const dataplaneRecordLimit = 100
const frozenNow = Date.parse(publishedAt)
const at = (offsetMs: number) => toDatetimeString(frozenNow + offsetMs)

// Lists are shuffled before hydration. Default to a Fisher-Yates no-op (every
// swap index equals the current index) so order assertions are deterministic;
// shuffle tests override the value. Restored after every test.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(1 - Number.EPSILON)
})
afterEach(() => {
  vi.restoreAllMocks()
})
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
      doc2Uri,
      site.standard.document.$build({
        title: 'Second article',
        site: pubUri,
        path: '/story2',
        publishedAt,
        textContent: 'four five six',
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
  // Gallery item backlinks by gallery.
  const galleryItems = new Map<AtUriString, AtUriString[]>([
    [galleryUri, [itemUri]],
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
        getRecordsByURI: ({ uris }) => {
          if (uris.length > dataplaneRecordLimit) {
            throw new ConnectError(
              `at most ${dataplaneRecordLimit} URIs are allowed`,
              Code.InvalidArgument,
            )
          }
          return { results: uris.map(lookup) }
        },
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
            collection === grainGalleryItem.$type
              ? (galleryItems.get(targetUri as AtUriString) ?? []).map(
                  (uri) => ({ uri }),
                )
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
  // Unconfigured, so every gate is off unless a test enables one.
  const featureGatesClient = new FeatureGatesClient({})
  const hydrator = new Hydrator(dataplane, [labeler], {
    debugFieldAllowedDids: new Set(),
    featureGatesClient,
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
  // Independent Iris upstream with its own client and fetch; never derived from
  // worker content.
  const iris = {
    response: { articles: [], recIdStr: '123' } as unknown,
    respond: undefined as
      undefined | ((request: Request) => Response | Promise<Response>),
    fetchMock: vi.fn<typeof globalThis.fetch>(),
  }
  iris.fetchMock.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    return iris.respond ? iris.respond(request) : Response.json(iris.response)
  })
  const ctx = {
    cfg,
    hydrator,
    views,
    featureGatesClient,
    irisClient: new Client(
      {
        service: 'https://iris.test',
        headers: { authorization: 'Bearer iris-key' },
        fetch: iris.fetchMock,
      },
      { strictResponseProcessing: false, validateResponse: false },
    ) as Client | undefined,
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
  const gateSpies: { mockRestore(): void }[] = []
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listen address')
  return {
    records,
    galleryItems,
    takenDown,
    takenDownActors,
    blockedActors,
    labels,
    dataplane,
    hydrator,
    cfg,
    ctx: ctx as unknown as { irisClient: Client | undefined },
    fetchMock,
    iris,
    featureGatesClient,
    /** Turns the Iris article gate on (or off) for this fixture's requests. */
    setIrisGate(enabled = true) {
      const spy = vi
        .spyOn(featureGatesClient, 'scope')
        .mockImplementation(() => ({
          Gate,
          checkGate: (gate) =>
            enabled && gate === Gate.AtmosphereExploreArticlesIrisEnable,
          checkGates: (gates) =>
            new Map(
              gates.map((gate) => [
                gate,
                enabled && gate === Gate.AtmosphereExploreArticlesIrisEnable,
              ]),
            ),
        }))
      gateSpies.push(spy)
      return spy
    },
    query: async (
      authenticated = false,
      params: app.bsky.unspecced.getAtmosphereExploreTab.$Params = {},
      headers: Partial<Record<string, string>> = {},
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
          ...(Object.fromEntries(
            Object.entries(headers).filter(([, value]) => value !== undefined),
          ) as Record<string, string>),
        },
      })
      const body = await response.json()
      return {
        status: response.status,
        body: body as app.bsky.unspecced.getAtmosphereExploreTab.$OutputBody,
      }
    },
    async [Symbol.asyncDispose]() {
      for (const spy of gateSpies) spy.mockRestore()
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
  articles: [group(missingUri), group(docUri), group(docUri)],
  publications: [group(pubUri)],
  photos: [group(galleryUri)],
  livestreams: [group(liveUri)],
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
    expect(body.articles.items.map(({ featured }) => featured)).toEqual([
      false,
      false,
    ])
    const article = body.articles.items[0].view
    expect(app.bsky.embed.external.viewArticle.$matches(article)).toBe(true)
    expect(article).toMatchObject({
      title: 'Article',
      uri: 'https://example.com/blog/story',
      likeCount: 7,
      readingTime: 1,
    })
    expect(
      body.articles.items[1].view.associatedRefs?.map(({ uri }) => uri),
    ).toEqual([docUri, pubUri])
    expect(article.publisher).toMatchObject({
      title: 'Publication',
      subscriptionCount: 4,
      theme: { background: '#ffffff', accent: '#0064ff' },
    })
    expect(
      app.bsky.embed.external.viewArticlePublication.$matches(
        body.publications.items[0].view,
      ),
    ).toBe(true)
    const gallery = body.photos.items[0].view
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
    expect(body.livestreams.items[0].view).toMatchObject({
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

  it('uses only canonicalUri as the root for every section, ignoring uris', async () => {
    await using fixture = await setup({
      articles: [{ canonicalUri: docUri, uris: [missingUri, pubUri] }],
      publications: [{ canonicalUri: pubUri, uris: ['bad'] }],
      photos: [{ canonicalUri: galleryUri, uris: [photoUri, null] }],
      livestreams: [{ canonicalUri: liveUri, uris: [missingUri] }],
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
    expect(lookup.mock.calls[0][0].uris).toEqual([
      docUri,
      pubUri,
      galleryUri,
      liveUri,
    ])
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      missingUri,
    )
    expect(body.articles.items).toHaveLength(1)
    expect(body.articles.items[0].featured).toBe(false)
    expect(body.publications.items).toHaveLength(1)
    expect(body.photos.items).toHaveLength(1)
    expect(body.photos.items[0].featured).toBe(false)
    expect(
      body.photos.items[0].view.associatedRefs?.map(({ uri }) => uri),
    ).toEqual([galleryUri, itemUri, photoUri])
    expect(body.livestreams.items).toHaveLength(1)
  })

  it('renders canonical-only entries and discovers their dependencies', async () => {
    await using fixture = await setup({
      articles: [{ canonicalUri: docUri }],
      photos: [{ canonicalUri: galleryUri }],
    })
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(lookup.mock.calls[0][0].uris).toEqual([docUri, galleryUri])
    const looked = lookup.mock.calls.flatMap(([params]) => params.uris)
    expect(looked).toEqual(expect.arrayContaining([pubUri, photoUri]))
    expect(body.articles.items[0].view.publisher).toMatchObject({
      title: 'Publication',
    })
    expect(
      body.photos.items[0].view.associatedRefs?.map(({ uri }) => uri),
    ).toEqual([galleryUri, itemUri, photoUri])
  })

  it('renders dependency passes larger than one record request', async () => {
    const galleries = Array.from({ length: 10 }, (_, i) =>
      atUri(author, grainGallery.$type, `large${i}`),
    )
    // The publication is not a root, so the first dependency pass is the
    // publication plus 100 items, and the next is 100 photos.
    await using fixture = await setup({
      articles: [group(docUri)],
      photos: galleries.map(group),
    })
    const alts = galleries.map((gallery, g) => {
      fixture.records.set(
        gallery,
        grainGallery.$build({ title: `Gallery ${g}`, createdAt: publishedAt }),
      )
      const items = Array.from({ length: 10 }, (_, i) => {
        const rkey = `large${g}-${i}`
        const item = atUri(author, grainGalleryItem.$type, rkey)
        const photo = atUri(author, grainPhoto.$type, rkey)
        fixture.records.set(
          item,
          grainGalleryItem.$build({
            gallery,
            item: photo,
            position: i,
            createdAt: publishedAt,
          }),
        )
        fixture.records.set(
          photo,
          grainPhoto.$build({
            photo: {
              $type: 'blob',
              ref: parseCid(photoCid),
              mimeType: 'image/jpeg',
              size: 12,
            },
            alt: `Photo ${rkey}`,
          }),
        )
        return item
      })
      fixture.galleryItems.set(gallery, items)
      return items.map((_, i) => `Photo large${g}-${i}`)
    })
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    const requests = lookup.mock.calls.map(([params]) => params.uris ?? [])
    expect(requests.map((uris) => uris.length)).toEqual([11, 100, 1, 100])
    expect(new Set(requests.flat()).size).toBe(212)
    expect(body.articles.items).toHaveLength(1)
    expect(body.articles.items[0].view.publisher).toMatchObject({
      title: 'Publication',
    })
    expect(body.photos.items.map(({ view }) => view.uri)).toEqual(galleries)
    expect(
      body.photos.items.map(({ view }) =>
        view.items.map(
          (item) =>
            app.bsky.embed.external.viewGalleryImage.$ifMatches(item)?.alt,
        ),
      ),
    ).toEqual(alts)
  })

  describe('invalid canonical roots', () => {
    const badRoots = (baseUri: AtUriString) => {
      const col = baseUri.split('/')[3]
      return [
        { note: 'missing', worker: {} },
        { note: 'null', worker: { canonicalUri: null } },
        { note: 'number', worker: { canonicalUri: 42 } },
        { note: 'array', worker: { canonicalUri: [baseUri] } },
        { note: 'empty', worker: { canonicalUri: '' } },
        { note: 'malformed', worker: { canonicalUri: 'bad' } },
        { note: 'authority only', worker: { canonicalUri: `at://${author}` } },
        {
          note: 'missing rkey',
          worker: { canonicalUri: `at://${author}/${col}` },
        },
        {
          note: 'handle authority',
          worker: { canonicalUri: `at://author.test/${col}/x` },
        },
      ]
    }

    test.each(lists)(
      'does not fall back to uris for $key when canonicalUri is unusable',
      async ({ key, baseUri }) => {
        for (const { worker } of badRoots(baseUri)) {
          await using fixture = await setup({
            [key]: [{ ...worker, uris: [baseUri, baseUri] }],
          })
          using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
          const { status, body } = await fixture.query()

          expect(status).toBe(200)
          expect(body[key].items).toEqual([])
          expect(lookup.mock.calls.flatMap(([params]) => params.uris)).toEqual(
            [],
          )
        }
      },
    )

    const wrongModality = {
      articles: pubUri,
      publications: liveUri,
      photos: photoUri,
      livestreams: pubUri,
    } as const

    test.each(lists)(
      'does not substitute uris for an unavailable or wrong-type $key root',
      async ({ key, baseUri, uriFor }) => {
        for (const canonicalUri of [uriFor('missing'), wrongModality[key]]) {
          await using fixture = await setup({
            [key]: [{ canonicalUri, uris: [baseUri] }],
          })
          using hydrate = vi.spyOn(
            fixture.hydrator,
            'hydrateEmbedExternalViewFromUris',
          )
          using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
          const { status, body } = await fixture.query()

          expect(status).toBe(200)
          expect(body[key].items).toEqual([])
          expect(hydrate.mock.calls[0][0]).toEqual([canonicalUri])
          expect(
            lookup.mock.calls.flatMap(([params]) => params.uris),
          ).not.toContain(baseUri)
        }
      },
    )

    test.each(lists)(
      'lets invalid $key roots consume selection slots without refilling',
      async ({ key, uriFor }) => {
        const roots = Array.from({ length: 8 }, (_, i) => uriFor(`root-${i}`))
        await using fixture = await setup({
          [key]: [
            { uris: [roots[0]] },
            { canonicalUri: null, uris: [roots[0]] },
            { canonicalUri: 'bad', uris: [roots[0]] },
            ...roots.slice(0, 7).map((canonicalUri) => ({ canonicalUri })),
            { canonicalUri: roots[7] },
          ],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status } = await fixture.query()

        expect(status).toBe(200)
        expect(lookup.mock.calls[0][0].uris).toEqual(roots.slice(0, 7))
        expect(
          lookup.mock.calls.flatMap(([params]) => params.uris),
        ).not.toContain(roots[7])
      },
    )
  })

  describe('ignored uris metadata', () => {
    test.each([
      { note: 'string', uris: 'not-an-array' },
      { note: 'null', uris: null },
      { note: 'number', uris: 42 },
      { note: 'object', uris: { a: 1 } },
      { note: 'empty', uris: [] },
      { note: 'non-URIs', uris: [1, null, 'bad'] },
      { note: 'oversized', uris: Array.from({ length: 5000 }, () => docUri) },
    ])('does not validate or count a $note uris value', async ({ uris }) => {
      for (const { key, baseUri } of lists) {
        await using fixture = await setup({
          [key]: [{ canonicalUri: baseUri, uris }],
        })
        const { status, body } = await fixture.query()

        expect(status).toBe(200)
        expect(body[key].items).toHaveLength(1)
      }
    })

    it('still counts ignored uris metadata toward the decoded body cap', async () => {
      await using fixture = await setup({
        articles: [
          {
            canonicalUri: docUri,
            uris: Array.from({ length: 12_000 }, () => docUri),
          },
        ],
      })
      using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
      expect((await fixture.query()).status).toBe(502)
      expect(lookup).not.toHaveBeenCalled()
    })
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
    const metadata = { startsAt: null, endsAt: null, uris: ['ignored'] }
    await using fixture = await setup({
      ...curated,
      articles: [
        { canonicalUri: docUri, ...metadata },
        { canonicalUri: docUri, featured: true, tags: [], locations: [] },
        {
          canonicalUri: docUri,
          featured: false,
          tags: ['general'],
          ...metadata,
        },
      ],
      publications: [{ canonicalUri: pubUri, ...metadata }],
      photos: [{ canonicalUri: galleryUri, tags: ['general'] }],
      livestreams: [{ canonicalUri: liveUri, locations: [] }],
    })
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    // Null schedules are not featured; a worker-supplied `featured` is ignored.
    expect(body.articles.items.map(({ featured }) => featured)).toEqual([
      false,
      false,
      false,
    ])
    expect(body.publications.items.map(({ featured }) => featured)).toEqual([
      false,
    ])
    expect(body.photos.items.map(({ featured }) => featured)).toEqual([false])
    expect(body.livestreams.items.map(({ featured }) => featured)).toEqual([
      false,
    ])
    expect(body.announcementBanner).toEqual(curatedBanner)
    expect(body.apps).toEqual(curated.apps)
    for (const key of lists.map(({ key }) => key))
      for (const item of body[key].items)
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
          canonicalUri: uri,
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
            expect(body[key].items.map((item) => item.featured)).toEqual([
              featured,
            ])
            expect(Object.keys(body[key].items[0]).sort()).toEqual([
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
          { canonicalUri: docUri },
          { canonicalUri: docUri, startsAt: at(-1), endsAt: at(1) },
          { canonicalUri: docUri, startsAt: at(1), endsAt: at(2) },
        ],
      })
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      const { body } = await fixture.query()
      expect(hydrate.mock.calls[0][0]).toEqual([docUri])
      expect(body.articles.items.map(({ featured }) => featured)).toEqual([
        true,
        false,
        false,
      ])
    })

    test.each([
      { key: 'articles', bad: { startsAt: 1 } },
      { key: 'articles', bad: { endsAt: true } },
      { key: 'publications', bad: { startsAt: 'tomorrow' } },
      { key: 'photos', bad: { endsAt: '2026-10-01' } },
      { key: 'livestreams', bad: { startsAt: 'soon' } },
      // Skipped even when the entry would be excluded by location.
      { key: 'articles', bad: { locations: ['JP'], endsAt: 'bad' } },
    ] as const)(
      'skips a $key entry with a malformed schedule $bad',
      async ({ key, bad }) => {
        const { baseUri } = lists.find((list) => list.key === key)!
        using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
        await using fixture = await setup({
          [key]: [{ canonicalUri: baseUri, ...bad }, { canonicalUri: baseUri }],
        })
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key].items.map((item) => item.featured)).toEqual([false])
      },
    )

    it('skips malformed entries beyond the selection cap', async () => {
      await using fixture = await setup({
        articles: [
          ...Array.from({ length: 10 }, () => ({ canonicalUri: docUri })),
          { canonicalUri: docUri, startsAt: 'bad' },
        ],
      })
      const { status, body } = await fixture.query()
      expect(status).toBe(200)
      expect(body.articles.items).toHaveLength(10)
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
          canonicalUri: u(name),
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
            .map((uri) => ({ canonicalUri: uri, tags: ['general'] })),
          { canonicalUri: roots[11], locations: ['US'] },
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
            ...missing.map((uri) => ({ canonicalUri: uri })),
            { canonicalUri: baseUri },
          ],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key].items).toEqual([])
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
            { canonicalUri: baseUri, tags: ['news'] },
            { canonicalUri: baseUri, tags: ['other'] },
            { canonicalUri: baseUri, tags: ['general'] },
            { canonicalUri: baseUri },
          ],
        })
        using hydrate = vi.spyOn(
          fixture.hydrator,
          'hydrateEmbedExternalViewFromUris',
        )
        const { body } = await fixture.query(false, {}, topics)
        expect(hydrate.mock.calls[0][0]).toEqual([baseUri])
        expect(body[key].items).toHaveLength(3)
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
        { canonicalUri: liveUri, tags: [] },
        { canonicalUri: docUri, tags: ['general'] },
        { canonicalUri: pubUri, tags: ['news-today'] },
        { canonicalUri: galleryUri, tags: ['Newsletter'] },
        { canonicalUri: itemUri, tags: ['New'] },
        { canonicalUri: photoUri, tags: ['news'] },
        { canonicalUri: missingUri, tags: ['News'] },
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
            { canonicalUri: uri, locations, tags: ['news'] },
            { canonicalUri: uri, locations, tags: ['general'] },
            { canonicalUri: uri, locations },
            { canonicalUri: uri, locations, tags: [] },
          ]
          expect(await selectedRoots(key, entries, params, topics)).toEqual(
            match ? [uri] : [],
          )
        }
      },
    )

    it('treats missing or empty locations as unrestricted, not as a location match', async () => {
      const entries = [
        { canonicalUri: pubUri, locations: [] },
        { canonicalUri: docUri, tags: ['general'], locations: [] },
        { canonicalUri: liveUri, tags: ['news'] },
        { canonicalUri: galleryUri, locations: ['US'] },
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
          canonicalUri: atUri(author, site.standard.document.$type, `a${i}`),
        })),
        publications: [{ canonicalUri: pubUri, locations: ['JP'] }],
        photos: [{ canonicalUri: galleryUri }],
        livestreams: [{ canonicalUri: liveUri, tags: ['other'] }],
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
      expect(body.publications.items).toEqual([])
      expect(body.photos.items).toHaveLength(1)
      expect(body.livestreams.items).toEqual([])
    })

    const active = { startsAt: at(-1), endsAt: at(1) }
    const expired = { startsAt: at(-2), endsAt: at(-1) }

    test.each(lists)(
      'places featured $key entries first, then bucket order, before the cap',
      async ({ key, uriFor }) => {
        const u = (name: string) => uriFor(name)
        const entry = (name: string, extra: object) => ({
          canonicalUri: u(name),
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
          ...roots.slice(0, 10).map((uri) => ({ canonicalUri: uri })),
          { canonicalUri: roots[10], ...active },
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
            { canonicalUri: baseUri },
            ...missing.map((uri) => ({ canonicalUri: uri, ...active })),
          ],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key].items).toEqual([])
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
      anonymous.body.articles.items[0].view.associatedProfiles?.[0].viewer,
    ).toBeUndefined()
    expect(relationships).not.toHaveBeenCalled()
    const authenticated = await fixture.query(true)
    expect(authenticated.status).toBe(200)
    expect(
      authenticated.body.articles.items[0].view.associatedProfiles?.[0].viewer
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
      articles: [group(docUri)],
    })
    fixture.takenDown.add(pubUri)
    expect((await fixture.query()).body.articles.items).toEqual([])
    fixture.takenDown.clear()
    fixture.records.set(
      docUri,
      site.standard.document.$build({
        title: 'Wrong site',
        site: atUri(author, site.standard.publication.$type, 'other'),
        publishedAt,
      }),
    )
    expect((await fixture.query()).body.articles.items).toEqual([])
  })

  test.each([
    { note: 'automatically discovered', publications: [] },
    { note: 'explicitly in another group', publications: [group(pubUri)] },
  ])(
    'renders a canonical document root with its publication $note',
    async ({ publications }) => {
      await using fixture = await setup({
        articles: [group(docUri)],
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
      expect(body.articles.items).toHaveLength(1)
      expect(body.articles.items[0].view).toMatchObject({
        title: 'Article',
        uri: 'https://example.com/blog/story',
        publisher: { title: 'Publication', subscriptionCount: 4 },
      })
      expect(
        body.articles.items[0].view.associatedRefs?.map(({ uri }) => uri),
      ).toEqual([docUri, pubUri])
      expect(body.publications.items).toHaveLength(publications.length)
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
      expect(body.articles.items).toEqual([])
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
    expect((await fixture.query()).body.photos.items).toHaveLength(1)
    expect(lookup).toHaveBeenCalledWith({ uris: [photoUri] })
    expect(fixture.records.get(itemUri)).not.toHaveProperty('position')
    fixture.takenDown.add(photoUri)
    expect((await fixture.query()).body.photos.items).toEqual([])
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
    expect(body.articles.items).toHaveLength(2)
    expect(body.publications.items).toHaveLength(1)
    expect(body.livestreams.items).toHaveLength(1)
    expect(
      body.photos.items[0].view.items.map(
        (item) =>
          app.bsky.embed.external.viewGalleryImage.$ifMatches(item)?.alt,
      ),
    ).toEqual(['Earlier photo', 'A photo'])
    expect(
      body.photos.items[0].view.associatedRefs?.map(({ uri }) => uri),
    ).toEqual([galleryUri, item2Uri, photo2Uri, itemUri, photoUri])
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
    expect((await fixture.query()).body.photos.items).toEqual([])
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      photoUri,
    )
  })

  it('keeps loose documents, but skips invalid canonical roots and invalid records', async () => {
    await using fixture = await setup({
      articles: [
        group(docUri),
        { canonicalUri: 'bad', uris: [docUri] },
        { canonicalUri: null, uris: [docUri] },
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
    expect(body.articles.items).toHaveLength(1)
    expect(body.articles.items[0].view.uri).toBe('https://example.com/loose')
    expect(body.articles.items[0].view.publisher).toBeUndefined()
    fixture.records.set(docUri, {
      $type: site.standard.document.$type,
      title: 42,
      site: pubUri,
    })
    expect((await fixture.query()).body.articles.items).toEqual([])
  })

  it('uses bounded, deduplicated profile previews', async () => {
    await using fixture = await setup({ articles: [group(docUri)] })
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
    expect(body.articles.items[0].view.likers?.map(({ did }) => did)).toEqual([
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
    const moderated = (await fixture.query()).body.articles.items[0].view
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
    expect((await fixture.query()).body.photos.items).toEqual([])
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
    expect(
      (await fixture.query()).body.livestreams.items[0].view,
    ).toMatchObject({
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
      await using fixture = await setup({ livestreams: [group(liveUri)] })
      fixture.records.set(
        liveUri,
        streamLivestream.$build({
          title: 'Stream',
          createdAt: publishedAt,
          lastSeenAt,
        }),
      )
      expect(
        (await fixture.query()).body.livestreams.items[0].view,
      ).toMatchObject({
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
        articles: { items: [] },
        publications: { items: [] },
        photos: { items: [] },
        livestreams: { items: [] },
        apps: [],
      },
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  describe('best-effort ingestion', () => {
    const bad = [
      'not-an-object',
      null,
      7,
      [],
      { canonicalUri: 'x', tags: 'general' },
      { canonicalUri: 'x', tags: [1] },
      { canonicalUri: 'x', tags: ['x'.repeat(129)] },
      { canonicalUri: 'x', tags: Array.from({ length: 101 }, () => 'a') },
      { canonicalUri: 'x', tags: null },
      { canonicalUri: 'x', locations: 'US' },
      { canonicalUri: 'x', locations: [null] },
      { canonicalUri: 'x', locations: ['U'.repeat(17)] },
      { canonicalUri: 'x', locations: Array.from({ length: 101 }, () => 'US') },
      { canonicalUri: 'x', startsAt: 'tomorrow' },
      { canonicalUri: 'x', endsAt: 1 },
    ]

    describe.each(lists)('$key', ({ key, baseUri }) => {
      test.each(bad.map((entry, i) => [i, entry] as const))(
        'skips malformed entry %i and keeps its valid siblings',
        async (_, entry) => {
          const fixed =
            entry && typeof entry === 'object' && !Array.isArray(entry)
              ? { ...entry, canonicalUri: baseUri }
              : entry
          await using fixture = await setup({
            [key]: [fixed, group(baseUri), fixed],
          })
          using hydrate = vi.spyOn(
            fixture.hydrator,
            'hydrateEmbedExternalViewFromUris',
          )
          const { status, body } = await fixture.query()
          expect(status).toBe(200)
          expect(body[key].items).toHaveLength(1)
          expect(hydrate.mock.calls[0][0]).toEqual([baseUri])
        },
      )

      it('examines only the first 100 entries', async () => {
        await using fixture = await setup({
          [key]: [...Array.from({ length: 100 }, () => 'bad'), group(baseUri)],
        })
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key].items).toEqual([])
        expect(lookup).not.toHaveBeenCalled()
      })

      it('does not reject more than 100 valid entries', async () => {
        await using fixture = await setup({
          [key]: Array.from({ length: 150 }, () => group(baseUri)),
        })
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body[key].items).toHaveLength(10)
      })
    })

    it('treats missing, non-array, and malformed sections as empty without clearing others', async () => {
      await using fixture = await setup({
        articles: 'articles',
        publications: { 0: group(pubUri) },
        photos: null,
        livestreams: [group(liveUri)],
        apps: 5,
        announcementBanners: 'banner',
      })
      const { status, body } = await fixture.query()
      expect(status).toBe(200)
      expect(body.articles.items).toEqual([])
      expect(body.publications.items).toEqual([])
      expect(body.photos.items).toEqual([])
      expect(body.livestreams.items).toHaveLength(1)
      expect(body.apps).toEqual([])
      expect(body.announcementBanner).toBeUndefined()
    })

    test.each([null, [], 'text', 7, true])(
      'returns empty sections for a decoded non-object body: %j',
      async (config) => {
        await using fixture = await setup(config)
        using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
        expect(await fixture.query()).toEqual({
          status: 200,
          body: {
            articles: { items: [] },
            publications: { items: [] },
            photos: { items: [] },
            livestreams: { items: [] },
            apps: [],
          },
        })
        expect(lookup).not.toHaveBeenCalled()
      },
    )

    describe('apps', () => {
      const app = (n: number) => ({
        id: `app-${n}`,
        title: `App ${n}`,
        url: 'https://example.com/app',
      })

      it('skips malformed app cards, keeping valid ones in order', async () => {
        await using fixture = await setup({
          apps: [
            app(1),
            { url: 123 },
            null,
            'app',
            { ...app(2), url: 5 },
            app(3),
          ],
        })
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body.apps).toEqual([app(1), app(3)])
      })

      it('examines only the first 100 app entries', async () => {
        await using fixture = await setup({
          apps: [...Array.from({ length: 100 }, () => 'bad'), app(1)],
        })
        const { status, body } = await fixture.query()
        expect(status).toBe(200)
        expect(body.apps).toEqual([])
      })
    })

    describe('announcement banners', () => {
      const banner = (id: string, extra: object = {}) => ({
        id,
        status: 'enabled',
        ...extra,
      })
      const us = { countryCode: 'US', regionCode: 'WI' }
      const malformed = [
        { status: 'enabled', title: 123 },
        { id: 'x', status: 'enabled', title: 123 },
        { id: 'x', status: 'enabled', url: 'not a uri' },
        { id: 'x', title: 'No status' },
        { id: 'x', status: 1 },
        { id: 'x', status: 'x'.repeat(129) },
        { id: 'x', status: 'enabled', startsAt: 'tomorrow' },
        { id: 'x', status: 'enabled', endsAt: 1 },
        { id: 'x', status: 'enabled', locations: 'US' },
        { id: 'x', status: 'enabled', locations: [1] },
        { id: 'x', status: 'enabled', locations: ['U'.repeat(17)] },
        null,
        'banner',
      ]

      async function pick(banners: unknown, params = {}) {
        await using fixture = await setup({
          announcementBanners: banners,
          articles: [group(docUri)],
        })
        const { status, body } = await fixture.query(false, params)
        expect(status).toBe(200)
        // Nonbanner content always survives bad banners.
        expect(body.articles.items).toHaveLength(1)
        return body.announcementBanner?.id
      }

      test.each(malformed.map((entry, i) => [i, entry] as const))(
        'keeps a valid banner despite malformed later banner %i',
        async (_, entry) => {
          expect(await pick([banner('valid'), entry])).toBe('valid')
        },
      )

      test.each(malformed.map((entry, i) => [i, entry] as const))(
        'lets a valid alternative win over malformed preferred banner %i',
        async (_, entry) => {
          const preferred =
            entry && typeof entry === 'object'
              ? { locations: ['US'], ...entry }
              : entry
          const expected = 'unrestricted'
          expect(await pick([preferred, banner(expected)], us)).toBe(expected)
          expect(
            await pick(
              [preferred, banner('targeted', { locations: ['US'] })],
              us,
            ),
          ).toBe('targeted')
        },
      )

      it('omits the banner when every banner is malformed', async () => {
        expect(await pick(malformed)).toBeUndefined()
      })
    })
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

type Fixture = Awaited<ReturnType<typeof setup>>

const articleUris = (...uris: string[]) => uris.map((uri) => ({ uri }))
// Worker article content that must never matter once Iris is the source.
const conflictingArticles = [group(missingUri), group(doc2Uri)]
const sections = ['articles', 'publications', 'photos', 'livestreams'] as const

async function setupIris(
  uris: string[] = [],
  config: Record<string, unknown> = {},
  recIdStr = 'rec-1',
) {
  const fixture = await setup({ articles: conflictingArticles, ...config })
  fixture.setIrisGate()
  fixture.iris.response = { articles: articleUris(...uris), recIdStr }
  return fixture
}

function irisRequests(fixture: Fixture) {
  return fixture.iris.fetchMock.mock.calls.map(
    ([input, init]) => new Request(input, init),
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

describe('Atmosphere Explore list ordering and caps', () => {
  const active = { startsAt: at(-1), endsAt: at(1) }
  const names = ['f1', 'f2', 'n1', 'n2']
  const titleField = {
    articles: 'title',
    publications: 'name',
    livestreams: 'title',
  } as const

  const rootOf = (view: { associatedRefs?: { uri: string }[] }) =>
    view.associatedRefs?.[0]?.uri

  it('shuffles each selected list before hydration, featured items first', async () => {
    using _now = vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
    // Index 0 on every swap: [f1, f2, n1, n2] shuffles to [f2, n1, n2, f1],
    // then featured items are hoisted to give [f2, f1, n1, n2].
    using _random = vi.spyOn(Math, 'random').mockReturnValue(0)
    await using fixture = await setup(
      Object.fromEntries(
        lists.map(({ key, uriFor }) => [
          key,
          names.map((name) => ({
            canonicalUri: uriFor(name),
            ...(name.startsWith('f') ? active : {}),
          })),
        ]),
      ),
    )
    for (const { key, baseUri, uriFor } of lists) {
      if (key === 'photos') continue
      for (const name of names)
        fixture.records.set(uriFor(name), {
          ...fixture.records.get(baseUri)!,
          [titleField[key]]: name,
        })
    }
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { status, body } = await fixture.query()
    expect(status).toBe(200)

    const expected = ['f2', 'f1', 'n1', 'n2']
    expect(hydrate.mock.calls[0][0]).toEqual(
      lists.flatMap(({ uriFor }) => expected.map((name) => uriFor(name))),
    )
    for (const { key, uriFor } of lists) {
      if (key === 'photos') continue
      const items = body[key].items
      expect(items.map(({ view }) => rootOf(view))).toEqual(
        expected.map((name) => uriFor(name)),
      )
      expect(items.map(({ featured }) => featured)).toEqual([
        true,
        true,
        false,
        false,
      ])
    }
  })

  it('shuffles Iris articles without marking them featured', async () => {
    using _random = vi.spyOn(Math, 'random').mockReturnValue(0)
    await using fixture = await setupIris([docUri, doc2Uri, docUri], {}, '9')
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { body } = await fixture.query()
    // [docUri, doc2Uri, docUri] -> [doc2Uri, docUri, docUri] under index 0.
    expect(hydrate.mock.calls[0][0]).toEqual([doc2Uri, docUri])
    expect(body.articles.items.map(({ view }) => rootOf(view))).toEqual([
      doc2Uri,
      docUri,
      docUri,
    ])
    expect(body.articles.items.every(({ featured }) => !featured)).toBe(true)
    expect(body.articles.recIdStr).toBe('9')
  })

  it('returns at most 10 apps in worker order without hydrating them', async () => {
    const apps = Array.from({ length: 12 }, (_, i) => ({
      ...curated.apps[0],
      title: `App ${i}`,
    }))
    await using fixture = await setup({ apps })
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(body.apps).toEqual(apps.slice(0, 10))
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('Atmosphere Explore article source (gate off)', () => {
  it('uses worker-curated articles without touching Iris or its client', async () => {
    await using fixture = await setup(curated)
    fixture.ctx.irisClient = undefined
    const { status, body } = await fixture.query(true)
    expect(status).toBe(200)
    expect(body.articles.items).toHaveLength(2)
    expect(fixture.fetchMock).toHaveBeenCalledOnce()
    expect(fixture.iris.fetchMock).not.toHaveBeenCalled()
    for (const section of sections) {
      expect(body[section]).not.toHaveProperty('recIdStr')
    }
  })

  it('stays off when the gate client is unconfigured, even with Iris configured', async () => {
    await using fixture = await setup(curated)
    const { status, body } = await fixture.query(true)
    expect(status).toBe(200)
    expect(body.articles.items).toHaveLength(2)
    expect(fixture.iris.fetchMock).not.toHaveBeenCalled()
  })

  it('does not fetch Iris when the gate is explicitly off', async () => {
    await using fixture = await setup(curated)
    using scope = fixture.setIrisGate(false)
    expect((await fixture.query()).status).toBe(200)
    expect(scope).toHaveBeenCalledOnce()
    expect(fixture.iris.fetchMock).not.toHaveBeenCalled()
  })

  test.each([
    {
      name: 'authenticated with device and session',
      authenticated: true,
      headers: { 'x-atproto-device-id': 'dev', 'x-atproto-session-id': 'sess' },
      expected: { did: viewer, deviceId: 'dev', sessionId: 'sess' },
    },
    {
      name: 'anonymous with device and session',
      authenticated: false,
      headers: { 'x-atproto-device-id': 'dev', 'x-atproto-session-id': 'sess' },
      expected: { did: undefined, deviceId: 'dev', sessionId: 'sess' },
    },
    {
      name: 'anonymous without analytics headers',
      authenticated: false,
      headers: {},
      expected: {
        did: undefined,
        deviceId: expect.stringMatching(/^anon-/),
        sessionId: expect.stringMatching(/^anon-/),
      },
    },
  ])(
    'evaluates the gate once, scoped to the request: $name',
    async ({ authenticated, headers, expected }) => {
      await using fixture = await setup()
      using scope = fixture.setIrisGate(false)
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      expect((await fixture.query(authenticated, {}, headers)).status).toBe(200)
      expect(scope).toHaveBeenCalledOnce()
      expect(scope.mock.calls[0][0]).toEqual(expected)
      // The same scoped client is shared with hydration.
      expect(hydrate.mock.calls[0][1].features.checkGate(Gate.AATest)).toBe(
        false,
      )
    },
  )
})

describe('Atmosphere Explore article source (gate on)', () => {
  it('validates Iris responses even when shared-client validation is off', async () => {
    await using fixture = await setupIris([docUri])
    const client = fixture.ctx.irisClient
    if (!client) throw new Error('Expected configured Iris client')
    using call = vi.spyOn(client, 'call')

    expect((await fixture.query()).status).toBe(200)
    expect(call).toHaveBeenCalledExactlyOnceWith(
      app.bsky.unspecced.getAtmosphereExploreArticleRecommendations,
      { limit: 10, viewer: undefined },
      {
        headers: expect.any(Object),
        signal: expect.any(AbortSignal),
        validateResponse: true,
      },
    )
    expect(client.xrpcDefaults.validateResponse).toBe(false)
  })

  it('uses Iris as the exclusive, non-featured article source', async () => {
    await using fixture = await setupIris(
      [doc2Uri, docUri, doc2Uri],
      curated,
      '4242',
    )
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()

    expect(status).toBe(200)
    expect(fixture.fetchMock).toHaveBeenCalledOnce()
    expect(fixture.iris.fetchMock).toHaveBeenCalledOnce()
    // Presentation keeps duplicates; hydration roots are deduplicated, and
    // worker-only article roots are never hydrated.
    expect(body.articles.items.map(({ view }) => view.title)).toEqual([
      'Second article',
      'Article',
      'Second article',
    ])
    expect(body.articles.items.map(({ featured }) => featured)).toEqual([
      false,
      false,
      false,
    ])
    expect(hydrate).toHaveBeenCalledWith(
      [doc2Uri, docUri, pubUri, galleryUri, liveUri],
      expect.objectContaining({ viewer: null }),
    )
    expect(hydrate.mock.calls.filter(([, , seen]) => !seen)).toHaveLength(1)
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      missingUri,
    )
    expect(body.articles.recIdStr).toBe('4242')
    for (const section of ['publications', 'photos', 'livestreams'] as const) {
      expect(body[section]).not.toHaveProperty('recIdStr')
    }
    expect(body).not.toHaveProperty('recIdStr')
    expect(body.articles.items.some((item) => 'recIdStr' in item)).toBe(false)
    // Other sections are unchanged worker content.
    expect(body.publications.items.map(({ featured }) => featured)).toEqual([
      false,
    ])
    expect(body.photos.items.map(({ featured }) => featured)).toEqual([false])
    expect(body.livestreams.items).toHaveLength(1)
    expect(body.announcementBanner).toEqual(curatedBanner)
    expect(body.apps).toEqual(curated.apps)
  })

  it('ignores worker article selection and hydration', async () => {
    await using fixture = await setupIris([docUri], {
      articles: Array.from({ length: 6 }, () => group(doc2Uri)),
    })
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(hydrate.mock.calls[0][0]).toEqual([docUri])
    expect(lookup.mock.calls.flatMap(([params]) => params.uris)).not.toContain(
      doc2Uri,
    )
    expect(body.articles.items).toHaveLength(1)
    expect(body.articles.items[0].view.title).toBe('Article')
  })

  it('drops malformed worker apps and non-article entries without failing', async () => {
    const goodApp = { id: 'ok', title: 'OK', url: 'https://example.com/ok' }
    await using fixture = await setupIris([docUri], {
      apps: [{ url: 123 }, goodApp],
      publications: ['bad', group(pubUri)],
    })
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(body.apps).toEqual([goodApp])
    expect(body.publications.items).toHaveLength(1)
    expect(body.articles.items).toHaveLength(1)
  })

  test.each(['garbage', null, [null, { tags: 5 }, 'x'], { a: 1 }])(
    'ignores malformed worker articles: %j',
    async (articles) => {
      await using fixture = await setupIris([docUri], { articles })
      const { status, body } = await fixture.query()
      expect(status).toBe(200)
      expect(body.articles.items).toHaveLength(1)
    },
  )

  it('caps Iris articles at 10 while selecting other sections locally', async () => {
    const ten = Array.from({ length: 10 }, () => docUri)
    await using fixture = await setupIris(ten, {
      photos: [
        { canonicalUri: photoUri, locations: ['JP'] },
        { canonicalUri: galleryUri, locations: ['US-WI'] },
      ],
    })
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { status, body } = await fixture.query(false, {
      countryCode: 'US',
      regionCode: 'US-WI',
    })
    expect(status).toBe(200)
    // Worker location/topic selection never applies to Iris articles.
    expect(body.articles.items).toHaveLength(10)
    expect(body.articles.items.every(({ featured }) => !featured)).toBe(true)
    expect(hydrate.mock.calls[0][0]).toEqual([docUri, galleryUri])
    expect(body.photos.items).toHaveLength(1)
  })

  it('falls back to worker articles for an empty Iris list, but not a fully filtered one', async () => {
    await using fixture = await setupIris([], curated, '77')
    const { body } = await fixture.query()
    // Worker articles [missing, doc, doc]: the missing root is dropped.
    expect(body.articles.items.map(({ view }) => view.title)).toEqual([
      'Article',
      'Article',
    ])
    expect(body.articles.recIdStr).toBe('77')
    fixture.iris.response = {
      articles: articleUris(missingUri, pubUri),
      recIdStr: '78',
    }
    fixture.takenDown.add(docUri)
    expect((await fixture.query()).body.articles).toEqual({
      items: [],
      recIdStr: '78',
    })
  })

  it('skips incomplete, handle-based, and wrong-collection roots', async () => {
    await using fixture = await setupIris(
      [
        pubUri,
        `at://${author}`,
        `at://${author}/${site.standard.document.$type}`,
        `at://author.test/${site.standard.document.$type}/story`,
        galleryUri,
        docUri,
      ],
      {},
    )
    using hydrate = vi.spyOn(
      fixture.hydrator,
      'hydrateEmbedExternalViewFromUris',
    )
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(hydrate).toHaveBeenCalledWith(
      [docUri],
      expect.objectContaining({ viewer: null }),
    )
    expect(body.articles.items).toHaveLength(1)
    expect(body.articles.recIdStr).toBe('rec-1')
  })

  test.each([
    {
      name: 'authenticated viewer, request language header',
      authenticated: true,
      params: {},
      headers: { 'accept-language': 'fr', 'x-atproto-bsky-topics': 'a,b' },
      viewer: viewer as string | null,
      language: 'fr',
    },
    {
      name: 'anonymous viewer, params.langs overrides the header',
      authenticated: false,
      params: { langs: ['en', 'es'], countryCode: 'US', regionCode: 'WI' },
      headers: { 'accept-language': 'fr', 'x-bsky-topics': 'legacy' },
      viewer: null,
      language: 'en,es',
    },
    {
      name: 'anonymous viewer, default client language header',
      authenticated: false,
      params: {},
      headers: { 'x-atproto-device-id': 'dev', 'x-atproto-session-id': 's' },
      viewer: null,
      language: '*',
    },
  ])('routes headers and query correctly: $name', async (route) => {
    await using fixture = await setupIris([docUri])
    const response = await fixture.query(
      route.authenticated,
      route.params,
      route.headers,
    )
    expect(response.status).toBe(200)

    const [iris] = irisRequests(fixture)
    const irisUrl = new URL(iris.url)
    expect(irisUrl.origin + irisUrl.pathname).toBe(
      `https://iris.test/xrpc/${app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$lxm}`,
    )
    expect(Object.fromEntries(irisUrl.searchParams)).toEqual({
      limit: '10',
      ...(route.viewer ? { viewer: route.viewer } : {}),
    })
    // The Iris bearer authenticates anonymous and authenticated viewers alike.
    expect(iris.headers.get('authorization')).toBe('Bearer iris-key')
    expect(iris.headers.get('accept-language')).toBe(route.language)
    for (const [name, value] of Object.entries(route.headers)) {
      if (name === 'accept-language') continue
      const forwarded =
        name === 'x-bsky-topics'
          ? iris.headers.get('x-atproto-bsky-topics')
          : iris.headers.get(name)
      expect(forwarded).toBe(value)
    }

    // Location is applied locally: it reaches neither upstream. Recommendation
    // headers go only to Iris.
    const worker = fixture.fetchMock.mock.calls[0][0] as Request
    expect([...new URL(worker.url).searchParams]).toEqual([])
    expect(worker.headers.get('authorization')).toBeNull()
    expect(worker.headers.get('accept-language')).toBeNull()
    expect(
      [...worker.headers.keys()].filter((name) => name.startsWith('x-')),
    ).toEqual([])
  })

  it('does not forward the user Authorization header to Iris or the worker', async () => {
    await using fixture = await setupIris([docUri])
    await fixture.query(true)
    expect(irisRequests(fixture)[0].headers.get('authorization')).toBe(
      'Bearer iris-key',
    )
    expect(
      (fixture.fetchMock.mock.calls[0][0] as Request).headers.get(
        'authorization',
      ),
    ).toBeNull()
  })

  it('scopes the gate to the verified viewer and request attributes', async () => {
    await using fixture = await setupIris([docUri])
    const scope = fixture.setIrisGate()
    await fixture.query(true, {}, { 'x-atproto-device-id': 'dev' })
    expect(scope).toHaveBeenCalledOnce()
    expect(scope.mock.calls[0][0]).toMatchObject({
      did: viewer,
      deviceId: 'dev',
    })
  })

  it('starts the worker and Iris requests concurrently', async () => {
    await using fixture = await setupIris([docUri])
    const worker = deferred<Response>()
    const iris = deferred<Response>()
    fixture.fetchMock.mockImplementation(() => worker.promise)
    fixture.iris.respond = () => iris.promise
    const pending = fixture.query()

    // Both started before either is released.
    await vi.waitFor(() => {
      expect(fixture.fetchMock).toHaveBeenCalledTimes(1)
      expect(fixture.iris.fetchMock).toHaveBeenCalledTimes(1)
    })
    worker.resolve(Response.json(curated))
    iris.resolve(
      Response.json({ articles: articleUris(docUri), recIdStr: 'late' }),
    )
    const { status, body } = await pending
    expect(status).toBe(200)
    expect(body.articles.recIdStr).toBe('late')
    expect(fixture.fetchMock).toHaveBeenCalledOnce()
    expect(fixture.iris.fetchMock).toHaveBeenCalledOnce()
  })

  describe('existing article scenarios', () => {
    it('omits articles with unavailable publication dependencies', async () => {
      await using fixture = await setupIris([docUri])
      fixture.takenDown.add(pubUri)
      expect((await fixture.query()).body.articles).toEqual({
        items: [],
        recIdStr: 'rec-1',
      })
      fixture.takenDown.clear()
      fixture.records.set(
        docUri,
        site.standard.document.$build({
          title: 'Wrong site',
          site: atUri(author, site.standard.publication.$type, 'other'),
          publishedAt,
        }),
      )
      expect((await fixture.query()).body.articles.items).toEqual([])
    })

    test.each([
      { note: 'automatically discovered', publications: [] },
      { note: 'explicitly in another group', publications: [group(pubUri)] },
    ])(
      'renders an Iris document root with its publication $note',
      async ({ publications }) => {
        await using fixture = await setupIris([docUri], { publications })
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
        expect(body.articles.items).toHaveLength(1)
        expect(body.articles.items[0].view).toMatchObject({
          title: 'Article',
          uri: 'https://example.com/blog/story',
          likeCount: 7,
          publisher: { title: 'Publication', subscriptionCount: 4 },
        })
        expect(
          body.articles.items[0].view.associatedRefs?.map(({ uri }) => uri),
        ).toEqual([docUri, pubUri])
        expect(body.publications.items).toHaveLength(publications.length)
      },
    )

    it('uses viewer-specific profile state only on authenticated requests', async () => {
      await using fixture = await setupIris([docUri])
      using relationships = vi.spyOn(fixture.dataplane, 'getRelationships')
      const anonymous = await fixture.query()
      expect(
        anonymous.body.articles.items[0].view.associatedProfiles?.[0].viewer,
      ).toBeUndefined()
      expect(relationships).not.toHaveBeenCalled()
      const authenticated = await fixture.query(true)
      expect(
        authenticated.body.articles.items[0].view.associatedProfiles?.[0].viewer
          ?.following,
      ).toBe(atUri(viewer, app.bsky.graph.follow.$type, 'follow'))
      expect(relationships.mock.calls[0][0].actorDid).toBe(viewer)
    })

    test.each(['record', 'label', 'actor', 'block'] as const)(
      'omits moderated Iris articles: %s',
      async (kind) => {
        await using fixture = await setupIris([docUri], {}, 'moderated')
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
        expect(body.articles).toEqual({ items: [], recIdStr: 'moderated' })
      },
    )
  })
})

describe.each(['worker', 'iris'] as const)(
  'Atmosphere Explore failure handling (%s articles)',
  (arm) => {
    const iris = arm === 'iris'
    async function arrange(config: unknown = curated) {
      const fixture = await setup(config)
      if (iris) {
        fixture.setIrisGate()
        fixture.iris.response = { articles: articleUris(docUri), recIdStr: '1' }
      }
      return fixture
    }
    const upstreamCalls = (fixture: Fixture) =>
      fixture.fetchMock.mock.calls.length +
      fixture.iris.fetchMock.mock.calls.length

    it('requires the worker and starts no fetch without it', async () => {
      await using fixture = await arrange()
      fixture.cfg.atmosphereExploreTabService = undefined
      expect((await fixture.query()).status).toBe(501)
      expect(upstreamCalls(fixture)).toBe(0)
    })

    test.each([
      ['http', () => new Response('', { status: 503 }), 502],
      ['json', () => new Response('{'), 502],
      ['network', () => Promise.reject(new TypeError('down')), 502],
      [
        'timeout',
        () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
        504,
      ],
      [
        'oversized',
        () => new Response(JSON.stringify({ padding: 'x'.repeat(512 * 1024) })),
        502,
      ],
    ] as const)('fails on worker %s errors', async (_, respond, status) => {
      await using fixture = await arrange()
      fixture.fetchMock.mockImplementation(async () => respond())
      using lookup = vi.spyOn(fixture.dataplane, 'getRecordsByURI')
      expect((await fixture.query()).status).toBe(status)
      expect(lookup).not.toHaveBeenCalled()
    })

    test.each([
      { apps: [{ url: 123 }] },
      { articles: 5, publications: 'x', photos: [1], livestreams: [null] },
      'not an object',
    ])('ignores malformed worker content: %j', async (config) => {
      await using fixture = await arrange()
      fixture.fetchMock.mockImplementation(async () => Response.json(config))
      expect((await fixture.query()).status).toBe(200)
    })
  },
)

describe('Atmosphere Explore Iris requirements and failures', () => {
  it('is unavailable without Iris when the gate is on, without fetching', async () => {
    await using fixture = await setupIris([docUri], curated)
    fixture.ctx.irisClient = undefined
    expect((await fixture.query()).status).toBe(501)
    expect(fixture.fetchMock).not.toHaveBeenCalled()
  })

  const malformedIrisBodies = [
    ['null body', null],
    ['array body', []],
    ['string body', 'text'],
    ['boolean body', true],
    ['number body', 7],
    ['empty object', {}],
    ['missing articles', { recIdStr: '1' }],
    ['null articles', { articles: null, recIdStr: '1' }],
    ['string articles', { articles: 'text', recIdStr: '1' }],
    ['object articles', { articles: {}, recIdStr: '1' }],
    ['missing rec ID', { articles: [] }],
    ['invalid rec ID', { articles: [{ uri: docUri }], recIdStr: 7 }],
    ['null article', { articles: [null], recIdStr: '1' }],
    ['missing article URI', { articles: [{}], recIdStr: '1' }],
    ['invalid article URI', { articles: [{ uri: 7 }], recIdStr: '1' }],
    ['malformed article URI', { articles: [{ uri: 'bad' }], recIdStr: '1' }],
    [
      'mixed valid and invalid articles',
      { articles: [{ uri: docUri }, null], recIdStr: '1' },
    ],
    [
      'invalid article beyond the output cap',
      {
        articles: [
          ...articleUris(...Array.from({ length: 10 }, () => docUri)),
          null,
        ],
        recIdStr: '1',
      },
    ],
  ] as const

  const irisFailures = [
    ['http', () => new Response('', { status: 503 })],
    ['network', () => Promise.reject(new TypeError('down'))],
    ['redirect', () => new Response('', { status: 302 })],
    ['invalid JSON', () => new Response('{')],
    [
      'timeout',
      () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    ],
  ] as const

  test.each([
    ...irisFailures,
    ...malformedIrisBodies.map(
      ([name, payload]) =>
        [
          `malformed 200 response: ${name}`,
          () => Response.json(payload),
        ] as const,
    ),
  ])(
    'falls back to worker-curated articles, without a rec ID, on Iris %s',
    async (_, respond) => {
      await using fixture = await setupIris([docUri], curated)
      fixture.iris.respond = async () => respond()
      using hydrate = vi.spyOn(
        fixture.hydrator,
        'hydrateEmbedExternalViewFromUris',
      )
      using warn = vi.spyOn(httpLogger, 'warn')
      const { status, body } = await fixture.query()

      expect(status).toBe(200)
      // Worker articles [missing, doc, doc]: the missing root is dropped.
      expect(body.articles.items.map(({ view }) => view.title)).toEqual([
        'Article',
        'Article',
      ])
      expect(body.articles).not.toHaveProperty('recIdStr')
      expect(body.publications.items).toHaveLength(1)
      expect(body.photos.items).toHaveLength(1)
      expect(body.livestreams.items).toHaveLength(1)
      expect(body.apps).toEqual(curated.apps)
      expect(body.announcementBanner).toEqual(curatedBanner)
      // Worker-curated article roots are hydrated; Iris roots never are.
      expect(hydrate).toHaveBeenCalledWith(
        [missingUri, docUri, pubUri, galleryUri, liveUri],
        expect.objectContaining({ viewer: null }),
      )
      expect(fixture.fetchMock).toHaveBeenCalledOnce()
      expect(fixture.iris.fetchMock).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledOnce()
      expect(JSON.stringify(warn.mock.calls)).not.toContain('iris-key')
    },
  )

  it('falls back to worker articles when Iris fails while the worker is pending', async () => {
    await using fixture = await setupIris([docUri], curated)
    const worker = deferred<Response>()
    fixture.fetchMock.mockImplementation(() => worker.promise)
    fixture.iris.respond = async () => new Response('', { status: 503 })
    const pending = fixture.query()

    // Both started concurrently; Iris has failed before the worker completes.
    await vi.waitFor(() => {
      expect(fixture.fetchMock).toHaveBeenCalledTimes(1)
      expect(fixture.iris.fetchMock).toHaveBeenCalledTimes(1)
    })
    worker.resolve(Response.json(curated))
    const { status, body } = await pending
    expect(status).toBe(200)
    expect(body.articles.items).toHaveLength(2)
    expect(body.articles).not.toHaveProperty('recIdStr')
    expect(body.publications.items).toHaveLength(1)
    expect(fixture.fetchMock).toHaveBeenCalledOnce()
    expect(fixture.iris.fetchMock).toHaveBeenCalledOnce()
  })

  test.each([
    ['http', () => new Response('', { status: 503 }), 502],
    [
      'timeout',
      () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
      504,
    ],
  ] as const)(
    'still fails on worker %s errors when Iris also fails',
    async (_, respond, status) => {
      await using fixture = await setupIris([docUri], curated)
      fixture.fetchMock.mockImplementation(async () => respond())
      fixture.iris.respond = async () => new Response('', { status: 503 })
      expect((await fixture.query()).status).toBe(status)
    },
  )

  it('truncates 11 articles to the 10 requested', async () => {
    await using fixture = await setupIris(
      Array.from({ length: 11 }, () => docUri),
      curated,
      '1',
    )
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    expect(body.articles.items).toHaveLength(10)
  })

  it('skips invalid roots within the prefix without backfilling', async () => {
    await using fixture = await setupIris(
      [
        ...Array.from({ length: 3 }, () => pubUri),
        ...Array.from({ length: 8 }, () => docUri),
      ],
      curated,
      '1',
    )
    const { status, body } = await fixture.query()
    expect(status).toBe(200)
    // @NOTE The first 10 contain 3 wrong-collection roots and 7 valid articles.
    expect(body.articles.items).toHaveLength(7)
  })
})
