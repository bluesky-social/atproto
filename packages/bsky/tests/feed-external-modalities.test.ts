import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, test } from 'vitest'
import {
  type AtUriString,
  type TypedLexMap,
  type UriString,
  atUri,
  lexStringify,
  parseCid,
} from '@atproto/lex'
import { createServer } from '@atproto/xrpc-server'
import registerAuthorFeed from '../src/api/app/bsky/feed/getAuthorFeed.js'
import registerPosts from '../src/api/app/bsky/feed/getPosts.js'
import type { AppContext } from '../src/context.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, com, place, site, social } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import { RecordLookupStatus } from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const author = 'did:plc:author'
const publisher = 'did:plc:publisher'
const labeler = 'did:plc:labeler'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const otherCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const blobCid = 'bafkreigh2akiscaildc5tww2o3w4g5ucuzji75ltsiqg2wfswnns66cinu'
const createdAt = '2026-10-01T00:00:00.000Z'
const nativeFetch = globalThis.fetch
const docUri = atUri(author, site.standard.document.$type, 'article')
const pubUri = atUri(publisher, site.standard.publication.$type, 'publication')
const galleryUri = atUri(author, social.grain.gallery.$type, 'gallery')
const itemUri = atUri(author, social.grain.gallery.item.$type, 'item')
const photoUri = atUri(author, social.grain.photo.$type, 'photo')
const liveUri = atUri(author, place.stream.livestream.$type, 'live')
const articleUrl = 'https://example.com/blog/article'
const publicationUrl = 'https://example.com/blog'
const blob = {
  $type: 'blob' as const,
  ref: parseCid(blobCid),
  mimeType: 'image/jpeg',
  size: 12,
}
const authoredThumb = { ...blob, ref: parseCid(otherCid) }
const image = (preset: string, did = author, imageCid = blobCid) =>
  `https://images.example.com/${preset}/plain/${did}/${imageCid}`
const ref = (uri: AtUriString, version = cid) => ({ uri, cid: version })
const versionKey = (uri: string, version: string) => `${uri}|${version}`
const backlinkKey = (uri: string, collection: string) => `${uri}|${collection}`
const document = (title = 'Article') =>
  site.standard.document.$build({
    site: pubUri,
    path: '/article',
    title,
    description: 'Article description',
    publishedAt: createdAt,
    updatedAt: createdAt,
    coverImage: blob,
    textContent: 'word '.repeat(201),
  })

async function setup() {
  const records = new Map<AtUriString, TypedLexMap>()
  const versions = new Map<string, TypedLexMap>()
  const latestCids = new Map<AtUriString, string>()
  const takenDown = new Set<string>()
  const labels: com.atproto.label.defs.Label[] = []
  const backlinks = new Map<string, AtUriString[]>()
  const exactLookups: { uri: string; cid: string }[] = []
  const latestLookups: string[] = []
  const feedUris: AtUriString[] = []
  const put = (uri: AtUriString, record: TypedLexMap, version = cid) => {
    versions.set(versionKey(uri, version), record)
    records.set(uri, record)
    latestCids.set(uri, version)
  }
  put(docUri, document())
  put(
    pubUri,
    site.standard.publication.$build({
      name: 'Publication',
      description: 'Publication description',
      url: publicationUrl,
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
  put(galleryUri, social.grain.gallery.$build({ title: 'Gallery', createdAt }))
  put(
    itemUri,
    social.grain.gallery.item.$build({
      gallery: galleryUri,
      item: photoUri,
      position: 0,
      createdAt,
    }),
  )
  put(
    photoUri,
    social.grain.photo.$build({ photo: blob, alt: 'A gallery photo' }),
  )
  backlinks.set(backlinkKey(galleryUri, social.grain.gallery.item.$type), [
    itemUri,
  ])
  put(
    liveUri,
    place.stream.livestream.$build({
      title: 'Livestream',
      url: 'https://stream.example.com/play',
      canonicalUrl: 'https://stream.example.com/author',
      createdAt,
      endedAt: createdAt,
      thumb: blob,
    }),
  )

  const seedPreviews = () => {
    const recommenders: string[] = []
    const subscribers: string[] = []
    for (let i = 0; i < 5; i++) {
      const recommender = `did:plc:recommender${i}` as const
      const subscriber = `did:plc:subscriber${i}` as const
      recommenders.push(recommender)
      subscribers.push(subscriber)
      const recommendUri = atUri(
        recommender,
        site.standard.graph.recommend.$type,
        'r',
      )
      const subscriptionUri = atUri(
        subscriber,
        site.standard.graph.subscription.$type,
        's',
      )
      put(
        recommendUri,
        site.standard.graph.recommend.$build({ document: docUri, createdAt }),
      )
      put(
        subscriptionUri,
        site.standard.graph.subscription.$build({
          publication: pubUri,
          createdAt,
        }),
      )
      for (const [target, collection, uri] of [
        [docUri, site.standard.graph.recommend.$type, recommendUri],
        [pubUri, site.standard.graph.subscription.$type, subscriptionUri],
      ] as const) {
        const key = backlinkKey(target, collection)
        backlinks.set(key, [...(backlinks.get(key) ?? []), uri])
      }
    }
    return { recommenders, subscribers }
  }
  const post = (
    key: string,
    refs: { uri: AtUriString; cid: string }[],
    url: UriString = articleUrl,
    nested = false,
  ) => {
    const uri = atUri(author, app.bsky.feed.post.$type, key)
    const external = app.bsky.embed.external.$build({
      external: {
        uri: url,
        title: 'Authored title',
        description: 'Authored description',
        thumb: authoredThumb,
        associatedRefs: refs,
      },
    })
    let embed: app.bsky.feed.post.Main['embed'] = external
    if (nested) {
      const quoted = atUri(author, app.bsky.feed.post.$type, 'quoted')
      put(quoted, app.bsky.feed.post.$build({ text: 'Quoted post', createdAt }))
      embed = app.bsky.embed.recordWithMedia.$build({
        record: app.bsky.embed.record.$build({ record: ref(quoted) }),
        media: external,
      })
    }
    put(uri, app.bsky.feed.post.$build({ text: key, createdAt, embed }))
    return uri
  }
  const lookup = (
    uri: string,
    version: string,
    record: TypedLexMap | undefined,
  ) => ({
    ref: { uri, cid: version },
    status: takenDown.has(uri)
      ? RecordLookupStatus.TAKEN_DOWN
      : record
        ? RecordLookupStatus.FOUND
        : RecordLookupStatus.NOT_FOUND,
    record: record
      ? { cid: version, record: Buffer.from(lexStringify(record)) }
      : undefined,
  })
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(({ service }) => {
      service(Service, {
        getPostRecords: ({ uris }) => ({
          records: uris.map((uri) => ({
            cid,
            record: records.has(uri as AtUriString)
              ? Buffer.from(lexStringify(records.get(uri as AtUriString)!))
              : new Uint8Array(),
          })),
          meta: uris.map(() => ({})),
        }),
        getInteractionCounts: () => ({}),
        getBlockExistence: ({ pairs }) => ({ blocks: pairs.map(() => ({})) }),
        getRecordsByRef: ({ refs }) => {
          exactLookups.push(...refs.map(({ uri, cid }) => ({ uri, cid })))
          return {
            results: refs.map(({ uri, cid }) =>
              lookup(uri, cid, versions.get(versionKey(uri, cid))),
            ),
          }
        },
        getRecordsByURI: ({ uris }) => {
          latestLookups.push(...uris)
          return {
            results: uris.map((uri) =>
              lookup(
                uri,
                latestCids.get(uri as AtUriString) ?? cid,
                records.get(uri as AtUriString),
              ),
            ),
          }
        },
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => ({
            targetUri,
            counts: {
              [site.standard.graph.recommend.$type]: 17n,
              [site.standard.graph.subscription.$type]: 23n,
              [social.grain.favorite.$type]: 9n,
            },
          })),
        }),
        getAtmosphereBacklinks: ({ targetUri, collection, limit }) => {
          return {
            backlinks: (backlinks.get(backlinkKey(targetUri, collection)) ?? [])
              .slice(0, limit)
              .map((uri) => ({ uri })),
          }
        },
        getActors: ({ dids }) => ({
          actors: dids.map(() => ({ exists: true, handle: 'reader.test' })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map(() => ({})),
        }),
        getLabels: () => ({
          labels: labels.map((label) => Buffer.from(lexStringify(label))),
        }),
        getAuthorFeed: () => ({ items: feedUris.map((uri) => ({ uri, cid })) }),
      })
    }),
  )
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
  const anonymous = async () => ({ credentials: { type: 'none', iss: null } })
  const ctx = {
    cfg: { externalRecordsSafeDomains: ['stream.example.com', 'grain.social'] },
    dataplane,
    hydrator,
    views,
    featureGatesClient,
    reqLabelers: () => ({ dids: [labeler], redact: new Set([labeler]) }),
    authVerifier: {
      standardOptionalParameterized: () => anonymous,
      optionalStandardOrRole: anonymous,
      parseCreds: () => ({
        viewer: null,
        includeTakedowns: false,
        skipViewerBlocks: false,
      }),
    },
  } as unknown as AppContext
  const xrpc = createServer([], { validateResponse: true })
  registerPosts(xrpc, ctx)
  registerAuthorFeed(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listen address')
  const request = async (method: string, params: [string, string][]) => {
    const url = new URL(`http://127.0.0.1:${address.port}/xrpc/${method}`)
    for (const [key, value] of params) url.searchParams.append(key, value)
    const response = await nativeFetch(url)
    const body = await response.json()
    expect(response.status).toBe(200)
    return body
  }
  return {
    records,
    versions,
    takenDown,
    labels,
    put,
    post,
    seedPreviews,
    exactLookups,
    latestLookups,
    feedUris,
    posts: async (uris: AtUriString[]) => {
      const body = await request(
        app.bsky.feed.getPosts.$lxm,
        uris.map((uri) => ['uris', uri]),
      )
      return body as app.bsky.feed.getPosts.$OutputBody
    },
    feed: async () => {
      const body = await request(app.bsky.feed.getAuthorFeed.$lxm, [
        ['actor', author],
      ])
      return body as app.bsky.feed.getAuthorFeed.$OutputBody
    },
    async [Symbol.asyncDispose]() {
      await server[Symbol.asyncDispose]()
    },
  }
}

function externalView(post: app.bsky.feed.defs.PostView) {
  const embed = post.embed
  if (!embed) throw new Error('Expected an embed')
  if (app.bsky.embed.external.view.$isTypeOf(embed)) return embed
  if (
    app.bsky.embed.recordWithMedia.view.$isTypeOf(embed) &&
    app.bsky.embed.external.view.$isTypeOf(embed.media)
  )
    return embed.media
  throw new Error('Expected an external embed')
}

const authoredCard = {
  uri: articleUrl,
  title: 'Authored title',
  description: 'Authored description',
  thumb: image('feed_thumbnail', author, otherCid),
}

describe('feed external modality views over HTTP', () => {
  it('hydrates article metadata, the publisher theme, counts and three real social previews', async () => {
    await using fixture = await setup()
    const { recommenders, subscribers } = fixture.seedPreviews()
    const uri = fixture.post('article', [ref(docUri), ref(pubUri)])
    const { posts } = await fixture.posts([uri])
    expect(posts).toHaveLength(1)
    const embed = externalView(posts[0])
    expect(embed.external).toMatchObject({
      ...authoredCard,
      title: 'Article',
      description: 'Article description',
    })
    const data = app.bsky.embed.external.viewArticle.$validate(embed.data)
    expect(data).toMatchObject({
      uri: articleUrl,
      title: 'Article',
      description: 'Article description',
      createdAt,
      updatedAt: createdAt,
      readingTime: 2,
      image: image('feed_thumbnail'),
      likeCount: 17,
      publisher: {
        title: 'Publication',
        description: 'Publication description',
        uri: publicationUrl,
        logo: image('avatar', publisher),
        subscriptionCount: 23,
        theme: {
          background: '#000fff',
          foreground: '#ff8000',
          accent: '#000000',
          accentForeground: '#ffffff',
        },
      },
    })
    expect(data.likers?.map((profile) => profile.did)).toEqual(
      recommenders.slice(0, 3),
    )
    expect(data.publisher?.subscribers?.map((profile) => profile.did)).toEqual(
      subscribers.slice(0, 3),
    )
    expect(
      data.likers?.every((profile) => profile.handle === 'reader.test'),
    ).toBe(true)
    expect(fixture.latestLookups).toContain(pubUri)
    expect(data.image).not.toBe(embed.external.thumb)
  })

  it('renders a standalone publication with hydrated subscribers and a legacy publication-first article pair', async () => {
    await using fixture = await setup()
    const { subscribers } = fixture.seedPreviews()
    const publication = fixture.post(
      'publication',
      [ref(pubUri)],
      publicationUrl,
    )
    const article = fixture.post('legacy-order', [ref(pubUri), ref(docUri)])
    const { posts } = await fixture.posts([publication, article])
    const data = app.bsky.embed.external.viewArticlePublication.$validate(
      externalView(posts[0]).data,
    )
    expect(data).toMatchObject({
      title: 'Publication',
      uri: publicationUrl,
      subscriptionCount: 23,
    })
    expect(data.subscribers?.map((profile) => profile.did)).toEqual(
      subscribers.slice(0, 3),
    )
    expect(externalView(posts[0]).external).toMatchObject({
      ...authoredCard,
      uri: publicationUrl,
      title: 'Publication',
      description: 'Publication description',
    })
    expect(
      app.bsky.embed.external.viewArticle.$matches(externalView(posts[1]).data),
    ).toBe(true)
  })

  it('hydrates gallery items and a deterministic ended livestream without replacing authored cards', async () => {
    await using fixture = await setup()
    const galleryUrl = 'https://grain.social/gallery'
    const liveUrl = 'https://stream.example.com/author'
    const gallery = fixture.post('gallery', [ref(galleryUri)], galleryUrl)
    const live = fixture.post('live', [ref(liveUri)], liveUrl)
    const { posts } = await fixture.posts([gallery, live])
    const galleryView = externalView(posts[0])
    const data = app.bsky.embed.external.viewGallery.$validate(galleryView.data)
    expect(data).toMatchObject({
      title: 'Gallery',
      likeCount: 9,
      items: [
        {
          alt: 'A gallery photo',
          thumbnail: image('feed_thumbnail'),
          fullsize: image('feed_fullsize'),
        },
      ],
    })
    expect(data.items).toHaveLength(1)
    expect(fixture.latestLookups).toEqual(
      expect.arrayContaining([itemUri, photoUri]),
    )
    expect(galleryView.external).toMatchObject({
      ...authoredCard,
      uri: galleryUrl,
    })
    const liveView = externalView(posts[1])
    expect(
      app.bsky.embed.external.viewLivestream.$validate(liveView.data),
    ).toMatchObject({
      title: 'Livestream',
      uri: liveUrl,
      active: false,
      startedAt: createdAt,
      endedAt: createdAt,
      image: image('feed_thumbnail'),
    })
    expect(liveView.external).toMatchObject({ ...authoredCard, uri: liveUrl })
  })

  it('retains two CID-pinned article versions while deriving the latest publisher dependency', async () => {
    await using fixture = await setup()
    fixture.put(docUri, {
      ...document(),
      labels: com.atproto.label.defs.selfLabels.$build({
        values: [{ val: 'old-version' }],
      }),
    })
    fixture.put(
      docUri,
      {
        ...document('New article'),
        labels: com.atproto.label.defs.selfLabels.$build({
          values: [{ val: 'new-version' }],
        }),
      },
      otherCid,
    )
    fixture.put(
      pubUri,
      site.standard.publication.$build({
        name: 'Latest publisher',
        url: publicationUrl,
      }),
      otherCid,
    )
    const old = fixture.post('old', [ref(docUri), ref(pubUri)])
    const current = fixture.post('current', [
      ref(docUri, otherCid),
      ref(pubUri),
    ])
    const { posts } = await fixture.posts([old, current])
    const data = posts.map((post) =>
      app.bsky.embed.external.viewArticle.$validate(externalView(post).data),
    )
    expect(data.map((article) => article.title)).toEqual([
      'Article',
      'New article',
    ])
    expect(data[0].labels).toEqual([
      expect.objectContaining({ uri: docUri, cid, val: 'old-version' }),
    ])
    expect(data[1].labels).toEqual([
      expect.objectContaining({
        uri: docUri,
        cid: otherCid,
        val: 'new-version',
      }),
    ])
    for (const article of data) {
      expect(article.publisher?.title).toBe('Latest publisher')
      expect(article.publisher?.associatedRefs).toEqual([
        expect.objectContaining(ref(pubUri, otherCid)),
      ])
    }
    expect(data[0].associatedRefs?.[0]).toMatchObject(ref(docUri))
    expect(data[1].associatedRefs?.[0]).toMatchObject(ref(docUri, otherCid))
    expect(fixture.exactLookups).toEqual(
      expect.arrayContaining([ref(docUri), ref(docUri, otherCid)]),
    )
    expect(fixture.latestLookups).not.toContain(docUri)
  })

  test.each([
    'missing root',
    'missing pinned version',
    'missing publisher',
    'URL mismatch',
    'invalid publication URL',
    'root takedown',
    'publisher takedown label',
  ])('keeps the authored card and omits data for %s', async (failure) => {
    await using fixture = await setup()
    if (failure === 'missing root') {
      fixture.versions.delete(versionKey(docUri, cid))
      fixture.records.delete(docUri)
    }
    if (failure === 'missing pinned version')
      fixture.versions.delete(versionKey(docUri, cid))
    if (failure === 'missing publisher') fixture.records.delete(pubUri)
    if (failure === 'invalid publication URL')
      fixture.records.set(
        pubUri,
        site.standard.publication.$build({
          name: 'Bad publication',
          url: 'ftp://example.com/blog',
        }),
      )
    if (failure === 'root takedown') fixture.takenDown.add(docUri)
    if (failure === 'publisher takedown label')
      fixture.labels.push({
        src: labeler,
        uri: pubUri,
        val: '!takedown',
        cts: createdAt,
      })
    const url =
      failure === 'URL mismatch' ? 'https://example.com/other' : articleUrl
    const uri = fixture.post('unavailable', [ref(docUri), ref(pubUri)], url)
    const { posts } = await fixture.posts([uri])
    expect(posts).toHaveLength(1)
    const embed = externalView(posts[0])
    expect(embed.external).toMatchObject({ ...authoredCard, uri: url })
    expect(embed).not.toHaveProperty('data')
    expect(fixture.exactLookups).not.toContainEqual(ref(pubUri))
  })

  it('does not let a discarded article ref replace an unavailable gallery root', async () => {
    await using fixture = await setup()
    fixture.versions.delete(versionKey(galleryUri, cid))
    const uri = fixture.post('ignored', [ref(galleryUri), ref(docUri)])
    const { posts } = await fixture.posts([uri])
    const embed = externalView(posts[0])
    expect(embed.external).toMatchObject(authoredCard)
    expect(embed).not.toHaveProperty('data')
    expect(fixture.exactLookups).toEqual([ref(galleryUri)])
    expect(fixture.latestLookups).not.toContain(docUri)
  })

  it('hydrates external data inside record-with-media on the HTTP author feed path', async () => {
    await using fixture = await setup()
    const { recommenders } = fixture.seedPreviews()
    fixture.feedUris.push(
      fixture.post('nested-media', [ref(docUri)], articleUrl, true),
    )
    const { feed } = await fixture.feed()
    expect(feed).toHaveLength(1)
    expect(
      app.bsky.embed.recordWithMedia.view.$matches(feed[0].post.embed),
    ).toBe(true)
    const embed = externalView(feed[0].post)
    expect(embed.external).toMatchObject({
      ...authoredCard,
      title: 'Article',
      description: 'Article description',
    })
    const data = app.bsky.embed.external.viewArticle.$validate(embed.data)
    expect(data.title).toBe('Article')
    expect(data.likers?.map((profile) => profile.did)).toEqual(
      recommenders.slice(0, 3),
    )
  })
})
