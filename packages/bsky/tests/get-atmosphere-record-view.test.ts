import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import {
  type AtUriString,
  type TypedLexMap,
  atUri,
  lexStringify,
  parseCid,
} from '@atproto/lex'
import { AuthRequiredError, createServer } from '@atproto/xrpc-server'
import register from '../src/api/app/bsky/unspecced/getAtmosphereRecordView.js'
import registerBatch from '../src/api/app/bsky/unspecced/getAtmosphereRecordViews.js'
import { AuthVerifier } from '../src/auth/verifier.js'
import type { AppContext } from '../src/context.js'
import { FeatureGatesClient } from '../src/feature-gates/index.js'
import { Hydrator } from '../src/hydration/hydrator.js'
import { ImageUriBuilder } from '../src/image/uri.js'
import { app, place, site, social } from '../src/lexicons/index.js'
import { Service } from '../src/proto/bsky_connect.js'
import { RecordLookupStatus } from '../src/proto/bsky_pb.js'
import { Views } from '../src/views/index.js'
import { VideoUriBuilder } from '../src/views/util.js'

const nativeFetch = globalThis.fetch
const author = 'did:plc:author'
const modService = 'did:plc:mod'
const viewer = 'did:plc:viewer'
const cidA = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const cidB = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const cidC = 'bafyreiepstd4a7mqporspzs5hdfy6azgqcp27z45haiiwjcyvxd2pnhkoi'
const publishedAt = '2026-10-01T00:00:00.000Z'

const docUri = atUri(author, site.standard.document.$type, 'story')
const pubUri = atUri(author, site.standard.publication.$type, 'publication')
const galleryUri = atUri(author, social.grain.gallery.$type, 'gallery')
const itemUri = atUri(author, social.grain.gallery.item.$type, 'item')
const photoUri = atUri(author, social.grain.photo.$type, 'photo')
const postUri = atUri(author, app.bsky.feed.post.$type, 'post')
const missingUri = atUri(author, site.standard.document.$type, 'missing')
const recommendUri = atUri(
  'did:plc:recommender',
  site.standard.graph.recommend.$type,
  'recommend',
)
const blob = {
  $type: 'blob' as const,
  ref: parseCid(cidB),
  mimeType: 'image/jpeg',
  size: 12,
}

const document = (title: string) =>
  site.standard.document.$build({
    title,
    site: pubUri,
    path: '/story',
    publishedAt,
  })

type Body = app.bsky.unspecced.getAtmosphereRecordView.$OutputBody
type BatchBody = app.bsky.unspecced.getAtmosphereRecordViews.$OutputBody

async function setup() {
  const latest = new Map<AtUriString, { cid: string; record: TypedLexMap }>([
    [docUri, { cid: cidA, record: document('Latest') }],
    [
      pubUri,
      {
        cid: cidA,
        record: site.standard.publication.$build({
          name: 'Publication',
          url: 'https://example.com/blog',
        }),
      },
    ],
    [
      galleryUri,
      {
        cid: cidA,
        record: social.grain.gallery.$build({
          title: 'Gallery',
          createdAt: publishedAt,
        }),
      },
    ],
    [
      itemUri,
      {
        cid: cidA,
        record: social.grain.gallery.item.$build({
          gallery: galleryUri,
          item: photoUri,
          position: 0,
          createdAt: publishedAt,
        }),
      },
    ],
    [
      photoUri,
      {
        cid: cidA,
        record: social.grain.photo.$build({ photo: blob, alt: 'A photo' }),
      },
    ],
    [
      postUri,
      {
        cid: cidA,
        record: app.bsky.feed.post.$build({
          text: 'Hi',
          createdAt: publishedAt,
        }),
      },
    ],
    [
      recommendUri,
      {
        cid: cidA,
        record: site.standard.graph.recommend.$build({
          document: docUri,
          createdAt: publishedAt,
        }),
      },
    ],
  ])
  /** Older exact versions, keyed by `uri@cid`. */
  const versions = new Map<string, TypedLexMap>([
    [`${docUri}@${cidB}`, document('Pinned')],
  ])
  const takenDown = new Set<string>()
  const blocked = new Set<string>()
  const backlinks = new Map<string, AtUriString[]>([
    [`${galleryUri}|${social.grain.gallery.item.$type}`, [itemUri]],
    [`${docUri}|${site.standard.graph.recommend.$type}`, [recommendUri]],
  ])

  const result = (
    uri: string,
    found?: { cid: string; record: TypedLexMap },
  ) => ({
    ref: { uri, cid: found?.cid ?? '' },
    status: takenDown.has(uri)
      ? RecordLookupStatus.TAKEN_DOWN
      : found
        ? RecordLookupStatus.FOUND
        : RecordLookupStatus.NOT_FOUND,
    record: found
      ? { cid: found.cid, record: Buffer.from(lexStringify(found.record)) }
      : undefined,
  })

  const dataplane = createPromiseClient(
    Service,
    createRouterTransport(({ service }) => {
      service(Service, {
        getRecordsByURI: ({ uris }) => ({
          results: uris.map((uri) => result(uri, latest.get(uri as never))),
        }),
        getRecordsByRef: ({ refs }) => ({
          results: refs.map(({ uri, cid }) => {
            const key = `${uri}@${cid}`
            const record = versions.get(key)
            const current = latest.get(uri as never)
            return result(
              uri,
              record
                ? { cid, record }
                : current?.cid === cid
                  ? current
                  : undefined,
            )
          }),
        }),
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => {
            const counts: Record<string, bigint> =
              targetUri === galleryUri
                ? { [social.grain.gallery.item.$type]: 27n }
                : { [site.standard.graph.recommend.$type]: 7n }
            return { targetUri, counts }
          }),
        }),
        getAtmosphereBacklinks: ({ collection, targetUri }) => ({
          backlinks: (backlinks.get(`${targetUri}|${collection}`) ?? []).map(
            (uri) => ({ uri }),
          ),
        }),
        getActors: ({ dids }) => ({
          actors: dids.map(() => ({ exists: true, handle: 'author.test' })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map((did) =>
            blocked.has(did)
              ? { blocking: 'at://did:plc:viewer/app.bsky.graph.block/1' }
              : {},
          ),
        }),
        getLabels: () => ({ labels: [] }),
      })
    }),
  )
  const hydrator = new Hydrator(dataplane, [], {
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
  // Production parseCreds; only the credential check is stubbed, reading the
  // caller's DID from a test header.
  const authVerifier = new AuthVerifier(dataplane, {
    ownDid: 'did:web:appview.test',
    alternateAudienceDids: [],
    modServiceDid: modService,
    adminPasses: [],
  })
  authVerifier.standard = async ({ req }) => {
    const iss = req.headers['x-test-iss']
    if (typeof iss !== 'string') throw new AuthRequiredError()
    return {
      credentials: { type: 'standard', iss: iss as never, aud: 'did:web:x' },
    }
  }
  const ctx = {
    hydrator,
    views,
    authVerifier,
    reqLabelers: () => ({ dids: [], redact: new Set<string>() }),
  } as unknown as AppContext
  const xrpc = createServer([], { validateResponse: true })
  register(xrpc, ctx)
  registerBatch(xrpc, ctx)
  const server = createHttpServer(xrpc.router)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('no address')

  const spies = {
    uris: vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromUris'),
    refs: vi.spyOn(hydrator, 'hydrateEmbedExternalViewFromRefs'),
    lookupUris: vi.spyOn(dataplane, 'getRecordsByURI'),
    lookupRefs: vi.spyOn(dataplane, 'getRecordsByRef'),
  }
  return {
    latest,
    versions,
    takenDown,
    blocked,
    spies,
    query: async (
      params: { uri: string; cid?: string },
      iss: string | null = viewer,
    ) => {
      const url = new URL(
        `http://127.0.0.1:${address.port}/xrpc/${app.bsky.unspecced.getAtmosphereRecordView.$lxm}`,
      )
      url.searchParams.set('uri', params.uri)
      if (params.cid) url.searchParams.set('cid', params.cid)
      const response = await nativeFetch(url, {
        headers: iss ? { 'x-test-iss': iss } : {},
      })
      return { status: response.status, body: (await response.json()) as Body }
    },
    fetchBatch: async (body: unknown, iss: string | null = viewer) => {
      const url = new URL(
        `http://127.0.0.1:${address.port}/xrpc/${app.bsky.unspecced.getAtmosphereRecordViews.$lxm}`,
      )
      const response = await nativeFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(iss ? { 'x-test-iss': iss } : {}),
        },
        body: JSON.stringify(body),
      })
      return {
        status: response.status,
        body: (await response.json()) as BatchBody,
      }
    },
    async [Symbol.asyncDispose]() {
      for (const spy of Object.values(spies)) spy.mockRestore()
      await server[Symbol.asyncDispose]()
    },
  }
}

const uris = (refs: { uri: string }[] | undefined) => refs?.map((r) => r.uri)
const basic = expect.objectContaining({ hydration: 'basic' })

describe('app.bsky.unspecced.getAtmosphereRecordView', () => {
  it('requires authentication', async () => {
    await using fixture = await setup()
    const { status } = await fixture.query({ uri: docUri }, null)
    expect(status).toBe(401)
    expect(fixture.spies.uris).not.toHaveBeenCalled()
  })

  it('returns the latest article with its publication using basic hydration', async () => {
    await using fixture = await setup()
    const { status, body } = await fixture.query({ uri: docUri })
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual([
      'associatedRecords',
      'associatedRefs',
      'view',
    ])
    expect(body.view?.$type).toBe(app.bsky.embed.external.viewArticle.$type)
    expect(body.view).toMatchObject({ title: 'Latest' })
    expect(body.associatedRefs).toMatchObject([
      { uri: docUri, cid: cidA },
      { uri: pubUri, cid: cidA },
    ])
    expect(body.associatedRecords?.[0]).toMatchObject({ title: 'Latest' })
    expect(fixture.spies.uris).toHaveBeenCalledWith(
      [docUri],
      expect.anything(),
      basic,
    )
    expect(fixture.spies.refs).not.toHaveBeenCalled()
    // Basic hydration shows counts but not social-preview engagement.
    expect(body.view).toMatchObject({ likeCount: 7 })
    expect(body.view).not.toHaveProperty('likers')
    expect(uris(body.associatedRefs)).not.toContain(recommendUri)
  })

  it('pins the exact version for the view and first association', async () => {
    await using fixture = await setup()
    const { body } = await fixture.query({ uri: docUri, cid: cidB })
    expect(body.view).toMatchObject({ title: 'Pinned' })
    expect(body.associatedRefs).toMatchObject([
      { uri: docUri, cid: cidB },
      { uri: pubUri, cid: cidA },
    ])
    expect(body.associatedRecords?.[0]).toMatchObject({ title: 'Pinned' })
    expect(fixture.spies.refs).toHaveBeenCalledWith(
      [{ uri: docUri, cid: cidB }],
      expect.anything(),
      basic,
    )
    expect(fixture.spies.uris).not.toHaveBeenCalledWith(
      [docUri],
      expect.anything(),
      expect.anything(),
    )
  })

  it('returns {} for an unavailable pin instead of the latest version', async () => {
    await using fixture = await setup()
    const { status, body } = await fixture.query({ uri: docUri, cid: cidC })
    expect(status).toBe(200)
    expect(body).toEqual({})
  })

  it('returns {} for a missing root', async () => {
    await using fixture = await setup()
    expect((await fixture.query({ uri: missingUri })).body).toEqual({})
  })

  it('returns gallery items and photos index-aligned', async () => {
    await using fixture = await setup()
    const { body } = await fixture.query({ uri: galleryUri })
    expect(body.view?.$type).toBe(app.bsky.embed.external.viewGallery.$type)
    expect(body.view).toMatchObject({
      photoCount: 27,
      items: [{ alt: 'A photo' }],
    })
    expect(uris(body.associatedRefs)).toEqual([galleryUri, itemUri, photoUri])
    expect(body.associatedRecords).toHaveLength(3)
    expect(body.associatedRecords?.[2]).toMatchObject({ alt: 'A photo' })
  })

  it('returns a livestream view', async () => {
    await using fixture = await setup()
    const liveUri = atUri(author, place.stream.livestream.$type, 'live')
    fixture.latest.set(liveUri, {
      cid: cidA,
      record: place.stream.livestream.$build({
        title: 'Live',
        url: 'https://good.com/replication',
        canonicalUrl: 'https://good.com/author',
        createdAt: publishedAt,
        lastSeenAt: new Date().toISOString() as never,
        thumb: blob,
      }),
    })
    const { body } = await fixture.query({ uri: liveUri })
    expect(body.view?.$type).toBe(app.bsky.embed.external.viewLivestream.$type)
  })

  it('returns only the raw record when it cannot produce a view', async () => {
    await using fixture = await setup()
    const { body } = await fixture.query({ uri: postUri })
    expect(body.view).toBeUndefined()
    expect(uris(body.associatedRefs)).toEqual([postUri])
    expect(body.associatedRecords).toHaveLength(1)
  })

  it.each([
    ['a handle-based URI', 'at://author.test/site.standard.document/story'],
    ['a URI without rkey', `at://${author}/site.standard.document`],
    ['a repo-only URI', `at://${author}`],
    ['a URI with a fragment', `${docUri}#frag`],
  ])('rejects %s before hydration', async (_, uri) => {
    await using fixture = await setup()
    const { status } = await fixture.query({ uri })
    expect(status).toBe(400)
    expect(fixture.spies.uris).not.toHaveBeenCalled()
    expect(fixture.spies.refs).not.toHaveBeenCalled()
  })

  describe.each([
    ['latest', {}],
    ['pinned', { cid: cidB }],
  ])('%s moderation visibility', (_, pin) => {
    it('hides takedowns from ordinary callers and shows them to Ozone', async () => {
      await using fixture = await setup()
      fixture.takenDown.add(docUri)
      const ordinary = await fixture.query({ uri: docUri, ...pin })
      expect(ordinary.body).toEqual({})
      const ozone = await fixture.query({ uri: docUri, ...pin }, modService)
      expect(ozone.body.view).toBeDefined()
      expect(uris(ozone.body.associatedRefs)?.[0]).toBe(docUri)
    })

    it('hides blocked authors from ordinary callers, not from Ozone', async () => {
      await using fixture = await setup()
      fixture.blocked.add(author)
      const ordinary = await fixture.query({ uri: docUri, ...pin })
      expect(ordinary.body).toEqual({})
      const ozone = await fixture.query({ uri: docUri, ...pin }, modService)
      expect(ozone.body.view).toBeDefined()
      expect(ozone.body.associatedRefs).toHaveLength(2)
    })
  })

  it('drops unavailable dependencies from the raw associations', async () => {
    await using fixture = await setup()
    // Hydrated, but rejected by isRecordAvailable: $type != collection.
    fixture.latest.set(pubUri, {
      cid: cidA,
      record: app.bsky.feed.post.$build({ text: 'x', createdAt: publishedAt }),
    })
    const { body } = await fixture.query({ uri: docUri })
    expect(uris(body.associatedRefs)).toEqual([docUri])
    expect(body.associatedRecords).toHaveLength(1)
  })
})

describe('app.bsky.unspecced.getAtmosphereRecordViews', () => {
  it('requires authentication', async () => {
    await using fixture = await setup()
    expect(
      (await fixture.fetchBatch({ records: [{ uri: docUri }] }, null)).status,
    ).toBe(401)
    expect(fixture.spies.lookupUris).not.toHaveBeenCalled()
    expect(fixture.spies.lookupRefs).not.toHaveBeenCalled()
  })

  it('batches mixed latest and exact versions in request order without mixing dependencies', async () => {
    await using fixture = await setup()
    const otherPub = atUri(author, site.standard.publication.$type, 'other')
    fixture.latest.set(otherPub, {
      cid: cidA,
      record: site.standard.publication.$build({
        name: 'Other publication',
        url: 'https://other.example.com',
      }),
    })
    fixture.versions.set(`${docUri}@${cidB}`, {
      ...document('Pinned'),
      site: otherPub,
    })
    fixture.versions.set(
      `${pubUri}@${cidB}`,
      site.standard.publication.$build({
        name: 'Old publication',
        url: 'https://old.example.com',
      }),
    )
    const { status, body } = await fixture.fetchBatch({
      records: [
        { uri: docUri },
        { uri: docUri, cid: cidB },
        { uri: docUri, cid: cidC },
        { uri: missingUri },
        { uri: postUri },
        { uri: docUri, cid: cidB },
        { uri: pubUri, cid: cidB },
      ],
    })
    expect(status).toBe(200)
    expect(body.views.map((result) => result.view)).toMatchObject([
      { title: 'Latest', publisher: { title: 'Publication' } },
      { title: 'Pinned', publisher: { title: 'Other publication' } },
      undefined,
      undefined,
      undefined,
      { title: 'Pinned' },
      { title: 'Old publication' },
    ])
    expect(body.views[0].associatedRefs).toMatchObject([
      { uri: docUri, cid: cidA },
      { uri: pubUri, cid: cidA },
    ])
    expect(body.views[1].associatedRefs).toMatchObject([
      { uri: docUri, cid: cidB },
      { uri: otherPub, cid: cidA },
    ])
    expect(body.views[1].associatedRecords).toMatchObject([
      { title: 'Pinned' },
      { name: 'Other publication' },
    ])
    expect(body.views[2]).toEqual({})
    expect(body.views[3]).toEqual({})
    expect(body.views[4].associatedRefs).toMatchObject([
      { uri: postUri, cid: cidA },
    ])
    expect(body.views[5]).toEqual(body.views[1])
    expect(body.views[6].associatedRefs).toMatchObject([
      { uri: pubUri, cid: cidB },
    ])
    expect(
      fixture.spies.lookupRefs.mock.calls.map(([req]) => req.refs),
    ).toEqual([
      [
        { uri: docUri, cid: cidB },
        { uri: docUri, cid: cidC },
        { uri: pubUri, cid: cidB },
      ],
    ])
    expect(
      fixture.spies.lookupUris.mock.calls.map(([req]) => req.uris),
    ).toEqual([
      [docUri, missingUri, postUri],
      [pubUri, otherPub],
    ])
  })

  it('keeps gallery associations separate from unrelated batch roots', async () => {
    await using fixture = await setup()
    const otherPhoto = atUri(author, social.grain.photo.$type, 'other')
    fixture.latest.set(otherPhoto, {
      cid: cidA,
      record: social.grain.photo.$build({ photo: blob, alt: 'Other photo' }),
    })
    const { status, body } = await fixture.fetchBatch({
      records: [{ uri: galleryUri }, { uri: otherPhoto }, { uri: docUri }],
    })
    expect(status).toBe(200)
    expect(uris(body.views[0].associatedRefs)).toEqual([
      galleryUri,
      itemUri,
      photoUri,
    ])
    expect(body.views[0].associatedRecords).toMatchObject([
      { title: 'Gallery' },
      { gallery: galleryUri, item: photoUri },
      { alt: 'A photo' },
    ])
    expect(body.views[0].view).toMatchObject({
      items: [{ alt: 'A photo' }],
    })
    expect(uris(body.views[1].associatedRefs)).toEqual([otherPhoto])
    expect(uris(body.views[2].associatedRefs)).toEqual([docUri, pubUri])
  })

  it.each([
    { records: [{ uri: docUri, cid: 'invalid' }] },
    { records: [{ uri: docUri, cid: '' }] },
    { records: [{ uri: docUri, cid: null }] },
    { records: [{}] },
    { records: [null] },
    {
      records: [
        { uri: docUri },
        { uri: 'at://author.test/site.standard.document/story' },
      ],
    },
    {
      records: [
        { uri: docUri },
        { uri: `at://${author}/site.standard.document` },
      ],
    },
    { records: [{ uri: docUri }, { uri: `${docUri}?query` }] },
    { records: Array.from({ length: 26 }, () => ({ uri: docUri })) },
    { records: [] },
    { records: { uri: docUri } },
    {},
  ])('rejects invalid batch %# before hydration', async (body) => {
    await using fixture = await setup()
    expect((await fixture.fetchBatch(body)).status).toBe(400)
    expect(fixture.spies.lookupUris).not.toHaveBeenCalled()
    expect(fixture.spies.lookupRefs).not.toHaveBeenCalled()
  })

  it('accepts the maximum batch size and preserves duplicate results', async () => {
    await using fixture = await setup()
    const { status, body } = await fixture.fetchBatch({
      records: Array.from({ length: 25 }, () => ({ uri: docUri })),
    })
    expect(status).toBe(200)
    expect(body.views).toEqual(Array.from({ length: 25 }, () => body.views[0]))
    expect(body.views[0].view).toMatchObject({ title: 'Latest' })
    expect(
      fixture.spies.lookupUris.mock.calls.map(([req]) => req.uris),
    ).toEqual([[docUri], [pubUri]])
  })

  it.each(['takedown', 'block'] as const)(
    'applies %s visibility to both latest and pinned batch roots',
    async (moderation) => {
      await using fixture = await setup()
      if (moderation === 'takedown') fixture.takenDown.add(docUri)
      else fixture.blocked.add(author)
      const input = { records: [{ uri: docUri }, { uri: docUri, cid: cidB }] }
      expect((await fixture.fetchBatch(input)).body).toEqual({
        views: [{}, {}],
      })
      const { body } = await fixture.fetchBatch(input, modService)
      expect(
        body.views.map((result) => result.associatedRefs?.[0]),
      ).toMatchObject([
        { uri: docUri, cid: cidA },
        { uri: docUri, cid: cidB },
      ])
      expect(body.views.map((result) => result.view)).toMatchObject([
        { title: 'Latest' },
        { title: 'Pinned' },
      ])
    },
  )

  it('omits unavailable dependencies without omitting visible roots', async () => {
    await using fixture = await setup()
    fixture.takenDown.add(pubUri)
    fixture.takenDown.add(photoUri)
    const { status, body } = await fixture.fetchBatch({
      records: [{ uri: docUri }, { uri: galleryUri }],
    })
    expect(status).toBe(200)
    expect(body.views[0].view).toBeUndefined()
    expect(uris(body.views[0].associatedRefs)).toEqual([docUri])
    expect(uris(body.views[1].associatedRefs)).toEqual([galleryUri, itemUri])
    expect(body.views[1].view).toMatchObject({ items: [] })
  })
})
