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
} from '@atproto/lex'
import { createServer } from '@atproto/xrpc-server'
import register from '../src/api/app/bsky/embed/getEmbedExternalView.js'
import type { AppContext } from '../src/context.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, type com, place, site, social } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import { RecordLookupStatus } from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const grainGallery = social.grain.gallery
const grainGalleryItem = social.grain.gallery.item
const grainPhoto = social.grain.photo
const nativeFetch = globalThis.fetch
const author = 'did:plc:author'
const labeler = 'did:plc:labeler'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const docCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const publishedAt = '2026-10-01T00:00:00.000Z'

const docUri = atUri(author, site.standard.document.$type, 'story')
const doc2Uri = atUri(author, site.standard.document.$type, 'story2')
const webDocUri = atUri(author, site.standard.document.$type, 'web')
const pubUri = atUri(author, site.standard.publication.$type, 'publication')
const pub2Uri = atUri(author, site.standard.publication.$type, 'publication2')
const galleryUri = atUri(author, grainGallery.$type, 'gallery')
const itemUri = atUri(author, grainGalleryItem.$type, 'item')
const photoUri = atUri(author, grainPhoto.$type, 'photo')
const liveUri = atUri(author, place.stream.livestream.$type, 'live')
const postUri = atUri(author, app.bsky.feed.post.$type, 'post')
const missingDocUri = atUri(author, site.standard.document.$type, 'missing')
const noTitleUri = atUri(author, site.standard.document.$type, 'untitled')
const brokenUri = atUri(author, site.standard.document.$type, 'broken')

const docUrl = 'https://example.com/blog/story'
const webDocUrl = 'https://web.example.com/posts/hello'
const safeDomains = ['good.com', '*.good.com']
const blob = {
  $type: 'blob' as const,
  ref: parseCid('bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'),
  mimeType: 'image/jpeg',
  size: 12,
}

type Body = app.bsky.embed.getEmbedExternalView.$OutputBody
type Query = {
  url: string
  canonicalUri?: string
  uris?: string[]
}

async function setup(domains: string[] = safeDomains) {
  const document = (documentSite: string, title = 'Article') =>
    site.standard.document.$build({
      title,
      site: documentSite as site.standard.document.Main['site'],
      path: '/story',
      publishedAt,
    })
  const records = new Map<AtUriString, TypedLexMap>([
    [docUri, document(pubUri)],
    [doc2Uri, document(pubUri, 'Second article')],
    [
      webDocUri,
      site.standard.document.$build({
        title: 'Web article',
        site: 'https://web.example.com',
        path: '/posts/hello',
        publishedAt,
      }),
    ],
    [noTitleUri, document(pubUri, '')],
    // Missing the required `title`.
    [
      brokenUri,
      { $type: site.standard.document.$type, site: pubUri } as TypedLexMap,
    ],
    [
      pubUri,
      site.standard.publication.$build({
        name: 'Publication',
        url: 'https://example.com/blog',
      }),
    ],
    [
      pub2Uri,
      site.standard.publication.$build({
        name: 'Second publication',
        url: 'https://example.com/other',
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
    [photoUri, grainPhoto.$build({ photo: blob, alt: 'A photo' })],
    [
      liveUri,
      place.stream.livestream.$build({
        title: 'Live',
        url: 'https://good.com/replication',
        canonicalUrl: 'https://good.com/author',
        createdAt: publishedAt,
        lastSeenAt: currentDatetimeString(),
        thumb: blob,
      }),
    ],
    [
      postUri,
      app.bsky.feed.post.$build({ text: 'Hi', createdAt: publishedAt }),
    ],
  ])
  const cids = new Map<string, string>([[docUri, docCid]])
  const takenDown = new Set<string>()
  const labels: com.atproto.label.defs.Label[] = []
  const lookup = (uri: string) => {
    const record = records.get(uri as AtUriString)
    const recordCid = cids.get(uri) ?? cid
    return {
      ref: { uri, cid: recordCid },
      status: takenDown.has(uri)
        ? RecordLookupStatus.TAKEN_DOWN
        : record
          ? RecordLookupStatus.FOUND
          : RecordLookupStatus.NOT_FOUND,
      record: record
        ? { cid: recordCid, record: Buffer.from(lexStringify(record)) }
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
          actors: dids.map(() => ({ exists: true, handle: 'author.test' })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map(() => ({})),
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
  const ctx = {
    cfg: { externalRecordsSafeDomains: domains },
    hydrator,
    views,
    reqLabelers: () => ({ dids: [labeler], redact: new Set([labeler]) }),
    authVerifier: {
      standardOptional: async () => ({
        credentials: { type: 'none', iss: null },
      }),
    } satisfies Pick<AppContext['authVerifier'], 'standardOptional'>,
  } as unknown as AppContext
  const xrpc = createServer([], { validateResponse: true })
  register(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing listen address')

  const spies = {
    hydrate: vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris'),
    lookup: vi.spyOn(dataplane, 'getRecordsByURI'),
    data: vi.spyOn(views, 'externalRecordView'),
    legacy: vi.spyOn(views, 'externalEmbedFromStandardSiteRecords'),
  }
  return {
    records,
    cids,
    takenDown,
    labels,
    spies,
    /** Root hydration invocations, excluding nested dependency passes. */
    roots: () =>
      spies.hydrate.mock.calls
        .filter(([, , seen]) => !seen)
        .map(([uris]) => uris),
    lookedUp: () => spies.lookup.mock.calls.flatMap(([{ uris }]) => uris),
    query: async ({ url, canonicalUri, uris }: Query) => {
      const request = new URL(
        `http://127.0.0.1:${address.port}/xrpc/${app.bsky.embed.getEmbedExternalView.$lxm}`,
      )
      request.searchParams.set('url', url)
      if (canonicalUri !== undefined)
        request.searchParams.set('canonicalUri', canonicalUri)
      for (const uri of uris ?? []) request.searchParams.append('uris', uri)
      const response = await nativeFetch(request)
      return { status: response.status, body: (await response.json()) as Body }
    },
    async [Symbol.asyncDispose]() {
      for (const spy of Object.values(spies)) spy.mockRestore()
      await server[Symbol.asyncDispose]()
    },
  }
}

const uriList = (refs: { uri: string }[] | undefined) => refs?.map((r) => r.uri)

/** Both request formats that normalize to a Standard.site root. */
const formats = (uri: AtUriString, url: string): [string, Query][] => [
  ['canonicalUri', { url, canonicalUri: uri }],
  ['legacy uris', { url, uris: [uri] }],
]

describe('app.bsky.embed.getEmbedExternalView', () => {
  describe('input normalization', () => {
    test.each([
      ['no URI input', {}],
      ['an empty legacy array', { uris: [] }],
      ['only non-Standard.site legacy URIs', { uris: [galleryUri, postUri] }],
      [
        'only ineligible legacy URIs',
        {
          uris: [
            `at://author.test/site.standard.document/story`,
            `at://${author}/site.standard.document`,
          ],
        },
      ],
      [
        'an ineligible canonicalUri, ignoring a valid legacy URI',
        {
          canonicalUri: `at://${author}/site.standard.document`,
          uris: [docUri],
        },
      ],
      [
        'a handle-based canonicalUri',
        { canonicalUri: 'at://author.test/site.standard.document/story' },
      ],
    ] as [string, Partial<Query>][])(
      'returns {} without hydration for %s',
      async (_, query) => {
        await using fixture = await setup()
        const { status, body } = await fixture.query({ url: docUrl, ...query })
        expect(status).toBe(200)
        expect(body).toEqual({})
        expect(fixture.spies.hydrate).not.toHaveBeenCalled()
        expect(fixture.spies.lookup).not.toHaveBeenCalled()
      },
    )

    test.each([
      ['a document before a publication', [pubUri, docUri], docUri],
      [
        'a document after a publication and other records',
        [galleryUri, pubUri, docUri],
        docUri,
      ],
      ['the first document', [doc2Uri, docUri, pubUri], doc2Uri],
      [
        'a publication when there is no document',
        [galleryUri, pub2Uri, pubUri],
        pub2Uri,
      ],
      ['a publication alone', [pubUri], pubUri],
    ] as [string, AtUriString[], AtUriString][])(
      'legacy normalization selects %s',
      async (_, uris, expected) => {
        await using fixture = await setup(['example.com'])
        await fixture.query({ url: docUrl, uris })
        expect(fixture.roots()).toEqual([[expected]])
      },
    )

    it('prefers canonicalUri over every legacy URI', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: 'https://good.com/gallery',
        canonicalUri: galleryUri,
        uris: [docUri, pubUri],
      })
      expect(fixture.roots()).toEqual([[galleryUri]])
      expect(fixture.lookedUp()).not.toContain(docUri)
      expect(fixture.lookedUp()).not.toContain(pubUri)
      expect(body.data?.$type).toBe(app.bsky.embed.external.viewGallery.$type)
    })

    it('does not fall back when the selected document is unavailable', async () => {
      await using fixture = await setup()
      const { status, body } = await fixture.query({
        url: docUrl,
        uris: [missingDocUri, pubUri],
      })
      expect(status).toBe(200)
      expect(body).toEqual({})
      expect(fixture.roots()).toEqual([[missingDocUri]])
      expect(fixture.lookedUp()).not.toContain(pubUri)
    })

    it('does not retry with the publication when validation fails', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: 'https://example.com/blog/different',
        uris: [docUri, pubUri],
      })
      expect(fixture.roots()).toEqual([[docUri]])
      expect(uriList(body.unverifiedAssociatedRefs)).toEqual([docUri, pubUri])
      expect(body.view).toBeUndefined()
      expect(body.data).toBeUndefined()
    })
  })

  describe('explicit canonicalUri never falls back to legacy uris', () => {
    const fallback = [docUri, pubUri]

    it('when the record is unavailable', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: missingDocUri,
        uris: fallback,
      })
      expect(body).toEqual({})
      expect(fixture.roots()).toEqual([[missingDocUri]])
      expect(fixture.lookedUp()).not.toContain(docUri)
    })

    it('when the record is untrusted', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: 'https://evil.com/gallery',
        canonicalUri: galleryUri,
        uris: fallback,
      })
      expect(body.unverifiedAssociatedRefs?.[0].uri).toBe(galleryUri)
      expect(fixture.lookedUp()).not.toContain(docUri)
    })

    it('when the record cannot be rendered', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: noTitleUri,
        uris: fallback,
      })
      expect(body.view).toBeUndefined()
      expect(body.data).toBeUndefined()
      expect(fixture.lookedUp()).not.toContain(docUri)
    })
  })

  describe('hydration', () => {
    test.each(formats(docUri, docUrl))(
      'hydrates only the canonical root and discovers the publication (%s)',
      async (_, query) => {
        await using fixture = await setup()
        const { body } = await fixture.query(query)
        expect(fixture.roots()).toEqual([[docUri]])
        expect(fixture.lookedUp()).toContain(pubUri)
        expect(uriList(body.associatedRefs)?.includes(pubUri)).toBe(true)
      },
    )

    it('uses hydration CIDs and keeps refs and records index-aligned', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: docUri,
      })
      expect(body.associatedRefs).toEqual([
        { $type: 'com.atproto.repo.strongRef', uri: docUri, cid: docCid },
        { $type: 'com.atproto.repo.strongRef', uri: pubUri, cid },
      ])
      expect(body.associatedRecords).toEqual([
        { ...fixtureRecord(fixture, docUri) },
        { ...fixtureRecord(fixture, pubUri) },
      ])
      expect(body.unverifiedAssociatedRefs).toBeUndefined()
      expect(body.unverifiedAssociatedRecords).toBeUndefined()
    })
  })

  describe('Standard.site', () => {
    test.each(formats(docUri, docUrl))(
      'a document with its publication returns a legacy view and article data (%s)',
      async (_, query) => {
        await using fixture = await setup()
        const { status, body } = await fixture.query(query)
        expect(status).toBe(200)
        expect(body.view?.external).toMatchObject({
          uri: docUrl,
          title: 'Article',
          associatedRefs: body.associatedRefs,
        })
        expect(app.bsky.embed.external.viewArticle.$matches(body.data)).toBe(
          true,
        )
        expect(body.data).toMatchObject({
          uri: docUrl,
          title: 'Article',
          likeCount: 7,
          publisher: { title: 'Publication', subscriptionCount: 4 },
        })
        expect(uriList(body.associatedRefs)).toEqual([docUri, pubUri])
        expect(fixture.spies.data).toHaveBeenCalledOnce()
        expect(fixture.spies.legacy).toHaveBeenCalledOnce()
      },
    )

    test.each(formats(webDocUri, webDocUrl))(
      'a web-URL document succeeds without a publication (%s)',
      async (_, query) => {
        await using fixture = await setup()
        const { body } = await fixture.query(query)
        expect(body.view?.external.title).toBe('Web article')
        expect(app.bsky.embed.external.viewArticle.$matches(body.data)).toBe(
          true,
        )
        expect(uriList(body.associatedRefs)).toEqual([webDocUri])
      },
    )

    test.each(formats(pubUri, 'https://example.com/blog'))(
      'a publication returns a legacy view and publication data (%s)',
      async (_, query) => {
        await using fixture = await setup()
        const { body } = await fixture.query(query)
        expect(body.view?.external).toMatchObject({
          uri: 'https://example.com/blog',
          title: 'Publication',
        })
        expect(
          app.bsky.embed.external.viewArticlePublication.$matches(body.data),
        ).toBe(true)
        expect(uriList(body.associatedRefs)).toEqual([pubUri])
      },
    )

    test.each([
      ['a URL mismatch', docUri, 'https://example.com/blog/other'],
      ['a different host', docUri, 'https://evil.com/blog/story'],
      ['a publication URL mismatch', pubUri, 'https://example.com/other'],
    ] as [string, AtUriString, string][])(
      'returns unverified output without building views for %s, even on an allowlisted host',
      async (_, uri, url) => {
        await using fixture = await setup(['example.com', 'evil.com'])
        const { status, body } = await fixture.query({ url, canonicalUri: uri })
        expect(status).toBe(200)
        expect(body.unverifiedAssociatedRefs?.[0].uri).toBe(uri)
        expect(body.unverifiedAssociatedRecords?.length).toBe(
          body.unverifiedAssociatedRefs?.length,
        )
        expect(body.view).toBeUndefined()
        expect(body.data).toBeUndefined()
        expect(body.associatedRefs).toBeUndefined()
        expect(body.associatedRecords).toBeUndefined()
        expect(fixture.spies.data).not.toHaveBeenCalled()
        expect(fixture.spies.legacy).not.toHaveBeenCalled()
      },
    )

    it('keeps the hydrated document in unverified output when its publication is missing', async () => {
      await using fixture = await setup()
      fixture.records.delete(pubUri)
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: docUri,
      })
      expect(uriList(body.unverifiedAssociatedRefs)).toEqual([docUri])
      expect(body.unverifiedAssociatedRecords).toEqual([
        fixtureRecord(fixture, docUri),
      ])
      expect(fixture.spies.data).not.toHaveBeenCalled()
      expect(fixture.spies.legacy).not.toHaveBeenCalled()
    })

    it('keeps an invalid-bodied document in unverified output', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: brokenUri,
      })
      expect(uriList(body.unverifiedAssociatedRefs)?.[0]).toBe(brokenUri)
      expect(body.view).toBeUndefined()
      expect(fixture.spies.legacy).not.toHaveBeenCalled()
    })

    it('returns normal associations without data or view when records validate but cannot render', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: noTitleUri,
      })
      expect(body.view).toBeUndefined()
      expect(body.data).toBeUndefined()
      expect(uriList(body.associatedRefs)).toEqual([noTitleUri, pubUri])
      expect(body.unverifiedAssociatedRefs).toBeUndefined()
    })

    it('includes labels on the legacy view and generic data', async () => {
      await using fixture = await setup()
      fixture.labels.push({
        src: labeler,
        uri: docUri,
        val: 'spicy',
        cts: publishedAt,
      })
      const { body } = await fixture.query({
        url: docUrl,
        canonicalUri: docUri,
      })
      expect(body.view?.external.labels?.map((l) => l.val)).toEqual(['spicy'])
      expect(
        (body.data as { labels?: { val: string }[] }).labels?.map((l) => l.val),
      ).toEqual(['spicy'])
    })
  })

  describe('generic records', () => {
    it('returns gallery data with dependencies, normal associations, and no legacy view', async () => {
      await using fixture = await setup()
      const { status, body } = await fixture.query({
        url: 'https://good.com/gallery/1',
        canonicalUri: galleryUri,
      })
      expect(status).toBe(200)
      expect(body.view).toBeUndefined()
      expect(fixture.spies.legacy).not.toHaveBeenCalled()
      expect(app.bsky.embed.external.viewGallery.$matches(body.data)).toBe(true)
      expect(body.data).toMatchObject({
        items: [{ alt: 'A photo' }],
      })
      expect(uriList(body.associatedRefs)).toEqual([
        galleryUri,
        itemUri,
        photoUri,
      ])
      expect(body.associatedRecords).toHaveLength(3)
      expect(body.unverifiedAssociatedRefs).toBeUndefined()
    })

    it('returns livestream data on a wildcard-trusted host', async () => {
      await using fixture = await setup(['*.good.com'])
      const { body } = await fixture.query({
        url: 'https://sub.good.com/live',
        canonicalUri: liveUri,
      })
      expect(app.bsky.embed.external.viewLivestream.$matches(body.data)).toBe(
        true,
      )
      expect(body.view).toBeUndefined()
      expect(fixture.spies.legacy).not.toHaveBeenCalled()
    })

    test.each([
      ['an unlisted host', safeDomains, 'https://evil.com/gallery'],
      ['a wildcard apex', ['*.good.com'], 'https://good.com/gallery'],
      ['plain HTTP', safeDomains, 'http://good.com/gallery'],
      ['an empty allowlist', [], 'https://good.com/gallery'],
    ] as [string, string[], string][])(
      'returns unverified output without building views for %s',
      async (_, domains, url) => {
        await using fixture = await setup(domains)
        const { status, body } = await fixture.query({
          url,
          canonicalUri: galleryUri,
        })
        expect(status).toBe(200)
        expect(uriList(body.unverifiedAssociatedRefs)).toEqual([
          galleryUri,
          itemUri,
          photoUri,
        ])
        expect(body.unverifiedAssociatedRecords).toHaveLength(3)
        expect(body.associatedRefs).toBeUndefined()
        expect(body.associatedRecords).toBeUndefined()
        expect(body.data).toBeUndefined()
        expect(body.view).toBeUndefined()
        expect(fixture.spies.data).not.toHaveBeenCalled()
        expect(fixture.spies.legacy).not.toHaveBeenCalled()
      },
    )

    it('validates the request url, not a url declared by the record', async () => {
      await using fixture = await setup(['evil.com'])
      // The livestream record declares good.com URLs, which are not trusted.
      const { body } = await fixture.query({
        url: 'https://evil.com/live',
        canonicalUri: liveUri,
      })
      expect(body.data).toBeDefined()
      const untrusted = await fixture.query({
        url: 'https://good.com/live',
        canonicalUri: liveUri,
      })
      expect(untrusted.body.data).toBeUndefined()
      expect(untrusted.body.unverifiedAssociatedRefs).toBeDefined()
    })

    it('returns normal associations without data for a supported-url record that has no modality', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: 'https://good.com/post',
        canonicalUri: postUri,
      })
      expect(body.data).toBeUndefined()
      expect(body.view).toBeUndefined()
      expect(uriList(body.associatedRefs)).toEqual([postUri])
      expect(fixture.spies.legacy).not.toHaveBeenCalled()
    })

    it('returns {} for a missing canonical record', async () => {
      await using fixture = await setup()
      const { body } = await fixture.query({
        url: 'https://good.com/gallery',
        canonicalUri: atUri(author, grainGallery.$type, 'nope'),
      })
      expect(body).toEqual({})
    })

    it('returns {} for a taken-down canonical record', async () => {
      await using fixture = await setup()
      fixture.takenDown.add(galleryUri)
      const { body } = await fixture.query({
        url: 'https://good.com/gallery',
        canonicalUri: galleryUri,
      })
      expect(body).toEqual({})
    })

    it('returns {} when the canonical record has a takedown label', async () => {
      await using fixture = await setup()
      fixture.labels.push({
        src: labeler,
        uri: galleryUri,
        val: '!takedown',
        cts: publishedAt,
      })
      const { body } = await fixture.query({
        url: 'https://good.com/gallery',
        canonicalUri: galleryUri,
      })
      expect(body).toEqual({})
    })
  })
})

function fixtureRecord(
  fixture: { records: Map<AtUriString, TypedLexMap> },
  uri: AtUriString,
) {
  return JSON.parse(lexStringify(fixture.records.get(uri)!))
}
