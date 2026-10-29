import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import {
  type AtUriString,
  type TypedLexMap,
  atUri,
  lexStringify,
  parseCid,
} from '@atproto/lex'
import { FeatureGatesClient } from '../../../../feature-gates/index.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { ImageUriBuilder } from '../../../../image/uri.js'
import { app, place, site, social } from '../../../../lexicons/index.js'
import { Service } from '../../../../proto/bsky_connect.js'
import { RecordLookupStatus } from '../../../../proto/bsky_pb.js'
import { Views } from '../../../../views/index.js'
import { VideoUriBuilder } from '../../../../views/util.js'
import { AtmosphereTimelineHydrator } from './atmosphere-hydration.js'

const author = 'did:plc:author'
const publisher = 'did:plc:publisher'
const viewer = 'did:plc:viewer'
const reader = 'did:plc:reader'
const labeler = 'did:plc:labeler'
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const createdAt = '2026-10-01T00:00:00.000Z'
const now = Date.parse(createdAt)
const documentUri = atUri(author, site.standard.document.$type, 'doc')
const publicationUri = atUri(publisher, site.standard.publication.$type, 'pub')
const galleryUri = atUri(author, social.grain.gallery.$type, 'gallery')
const itemUri = atUri(author, social.grain.gallery.item.$type, 'item')
const photoUri = atUri(author, social.grain.photo.$type, 'photo')
const streamUri = atUri(author, place.stream.livestream.$type, 'stream')
const recommendUri = atUri(reader, site.standard.graph.recommend.$type, 'rec')
const subscriptionUri = atUri(
  viewer,
  site.standard.graph.subscription.$type,
  'sub',
)
const favoriteUri = atUri(viewer, social.grain.favorite.$type, 'fav')
const postUri = atUri(viewer, app.bsky.feed.post.$type, 'share')

function setup() {
  const records = new Map<AtUriString, TypedLexMap>([
    [
      documentUri,
      site.standard.document.$build({
        title: 'Article',
        site: publicationUri,
        path: '/article',
        publishedAt: createdAt,
      }),
    ],
    [
      publicationUri,
      site.standard.publication.$build({
        name: 'Publication',
        url: 'https://example.com',
      }),
    ],
    [galleryUri, social.grain.gallery.$build({ title: 'Gallery', createdAt })],
    [
      itemUri,
      social.grain.gallery.item.$build({
        gallery: galleryUri,
        item: photoUri,
        position: 0,
        createdAt,
      }),
    ],
    [
      photoUri,
      social.grain.photo.$build({
        photo: {
          $type: 'blob',
          ref: parseCid(
            'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
          ),
          mimeType: 'image/jpeg',
          size: 12,
        },
        alt: 'Photo',
      }),
    ],
    [
      streamUri,
      place.stream.livestream.$build({
        title: 'Stream',
        url: 'https://stream.place/author',
        createdAt,
      }),
    ],
    [
      recommendUri,
      site.standard.graph.recommend.$build({
        document: documentUri,
        createdAt,
      }),
    ],
    [
      subscriptionUri,
      site.standard.graph.subscription.$build({ publication: publicationUri }),
    ],
    [
      favoriteUri,
      social.grain.favorite.$build({ subject: galleryUri, createdAt }),
    ],
    [
      postUri,
      app.bsky.feed.post.$build({
        text: 'Read this',
        createdAt,
        embed: app.bsky.embed.external.$build({
          external: {
            uri: 'https://example.com/article',
            title: 'Article',
            description: '',
            associatedRefs: [{ uri: documentUri, cid }],
          },
        }),
      }),
    ],
  ])
  const hidden = new Set<string>()
  const unavailable = new Set<string>()
  const muted = new Set<string>()
  const blocked = new Set<string>()
  const following = new Set<string>()
  const labels: { uri: string; val: string }[] = []
  const subscribed = new Set<AtUriString>()
  let truncated = false
  const lookupCalls: string[][] = []
  const exactCalls: string[][] = []
  const subscriptionCalls: string[][] = []
  const postCalls: string[][] = []
  const lookup = (uri: string) => {
    const record = records.get(uri as AtUriString)
    return {
      ref: { uri, cid },
      status: hidden.has(uri)
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
          lookupCalls.push(uris)
          return { results: uris.map(lookup) }
        },
        getRecordsByRef: ({ refs }) => {
          exactCalls.push(refs.map(({ uri }) => uri))
          return { results: refs.map(({ uri }) => lookup(uri)) }
        },
        getAtmosphereBacklinkCounts: ({ targetUris }) => ({
          results: targetUris.map((targetUri) => ({
            targetUri,
            counts: {
              [site.standard.graph.recommend.$type]: 7n,
              [site.standard.graph.subscription.$type]: 4n,
              [social.grain.favorite.$type]: 3n,
            },
          })),
        }),
        getAtmosphereBacklinks: ({ targetUri, collection }) => ({
          backlinks:
            targetUri === galleryUri &&
            collection === social.grain.gallery.item.$type
              ? [{ uri: itemUri }]
              : [],
        }),
        getAtmosphereBacklinksByActor: ({ targetUris }) => {
          subscriptionCalls.push(targetUris)
          return {
            truncated,
            results: targetUris.map((targetUri) => ({
              targetUri,
              uris: subscribed.has(targetUri as AtUriString)
                ? [subscriptionUri]
                : [],
            })),
          }
        },
        getActors: ({ dids }) => ({
          actors: dids.map((did) => ({
            exists: !unavailable.has(did),
            handle: 'author.test',
          })),
        }),
        getRelationships: ({ targetDids }) => ({
          relationships: targetDids.map((did) => ({
            muted: muted.has(did),
            blockedBy: blocked.has(did)
              ? atUri(author, app.bsky.graph.block.$type, 'block')
              : '',
            following: following.has(did)
              ? atUri(viewer, app.bsky.graph.follow.$type, 'follow')
              : '',
          })),
        }),
        getLabels: () => ({
          labels: labels.map((label) =>
            Buffer.from(
              lexStringify({
                ...label,
                src: labeler,
                cts: createdAt,
              }),
            ),
          ),
        }),
        getPostRecords: ({ uris }) => {
          postCalls.push(uris)
          return {
            records: uris.map((uri) => ({
              cid,
              record: Buffer.from(
                lexStringify(records.get(uri as AtUriString)!),
              ),
            })),
            meta: uris.map(() => ({})),
          }
        },
        getInteractionCounts: () => ({}),
        getLikesByActorAndSubjects: () => ({}),
        getRepostsByActorAndSubjects: () => ({}),
        getBookmarksByActorAndSubjects: () => ({}),
        getThreadMutesOnSubjects: () => ({}),
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
  const ctx = new HydrateCtx({
    viewer,
    labelers: { dids: [labeler], redact: new Set([labeler]) },
    features: featureGatesClient.scope({ did: viewer }),
  }) as HydrateCtx & { viewer: string }
  const timeline = new AtmosphereTimelineHydrator({ hydrator, views }, ctx, now)
  return {
    timeline,
    hydrator,
    records,
    hidden,
    unavailable,
    muted,
    blocked,
    following,
    labels,
    subscribed,
    lookupCalls,
    exactCalls,
    subscriptionCalls,
    postCalls,
    setTruncated(value: boolean) {
      truncated = value
    },
  }
}

describe('AtmosphereTimelineHydrator', () => {
  it('hydrates every supported root and action target through basic traversal', async () => {
    const f = setup()
    const roots = [
      documentUri,
      publicationUri,
      galleryUri,
      streamUri,
      recommendUri,
      subscriptionUri,
      favoriteUri,
    ]
    await f.timeline.hydrate(roots)
    const activities = roots.map((uri) => f.timeline.activity(uri, now))
    expect(activities.map((activity) => activity?.item.view?.$type)).toEqual([
      app.bsky.embed.external.viewArticle.$type,
      app.bsky.embed.external.viewArticlePublication.$type,
      app.bsky.embed.external.viewGallery.$type,
      app.bsky.embed.external.viewLivestream.$type,
      app.bsky.embed.external.viewArticle.$type,
      app.bsky.embed.external.viewArticlePublication.$type,
      app.bsky.embed.external.viewGallery.$type,
    ])
    expect(activities.slice(4).map((activity) => activity?.target)).toEqual([
      documentUri,
      publicationUri,
      galleryUri,
    ])
    expect(activities[0]?.item.view).toMatchObject({ likeCount: 7 })
    expect(activities[2]?.item.view).toMatchObject({
      items: [{ alt: 'Photo' }],
      likeCount: 3,
    })
    expect(activities[3]?.groupable).toBe(false)
    for (const activity of activities) {
      expect(
        app.bsky.unspecced.getAtmosphereTimeline.atmosphereItem.$matches(
          activity?.item,
        ),
      ).toBe(true)
    }
  })

  it('fetches action targets even when they are not roots', async () => {
    const f = setup()
    await f.timeline.hydrate([recommendUri, subscriptionUri, favoriteUri])
    expect(f.timeline.activity(recommendUri, now)?.target).toBe(documentUri)
    expect(f.timeline.activity(subscriptionUri, now)?.target).toBe(
      publicationUri,
    )
    expect(f.timeline.activity(favoriteUri, now)?.target).toBe(galleryUri)
    expect(f.lookupCalls.flat()).toEqual(
      expect.arrayContaining([
        documentUri,
        publicationUri,
        galleryUri,
        itemUri,
        photoUri,
      ]),
    )
  })

  it.each(['missing', 'takedown', 'unavailable', 'blocked', 'muted', 'review'])(
    'filters roots and required article targets for %s moderation',
    async (kind) => {
      const f = setup()
      if (kind === 'missing') f.records.delete(documentUri)
      if (kind === 'takedown') f.hidden.add(documentUri)
      if (kind === 'unavailable') f.unavailable.add(author)
      if (kind === 'blocked') f.blocked.add(author)
      if (kind === 'muted') f.muted.add(author)
      if (kind === 'review')
        f.labels.push({ uri: documentUri, val: 'needs-review' })
      await f.timeline.hydrate([documentUri, recommendUri])
      expect(f.timeline.activity(documentUri, now)).toBeUndefined()
      expect(f.timeline.activity(recommendUri, now)).toBeUndefined()
    },
  )

  it('filters a hidden publisher, without filtering arbitrary positive labels', async () => {
    const hidden = setup()
    hidden.muted.add(publisher)
    await hidden.timeline.hydrate([documentUri])
    expect(hidden.timeline.activity(documentUri, now)).toBeUndefined()
    const visible = setup()
    visible.labels.push({ uri: documentUri, val: 'art' })
    await visible.timeline.hydrate([documentUri])
    expect(visible.timeline.activity(documentUri, now)).toBeDefined()
  })

  it('uses needs-review follow exemptions and only loaded visible overflow profiles', async () => {
    const f = setup()
    expect(f.timeline.profile(author)).toBeUndefined()
    f.labels.push({ uri: documentUri, val: 'needs-review' })
    f.following.add(author)
    f.muted.add(publisher)
    await f.timeline.hydrate([documentUri])
    expect(f.timeline.profile(author)?.did).toBe(author)
    expect(f.timeline.profile(publisher)).toBeUndefined()
    expect(f.timeline.profile('did:plc:unloaded')).toBeUndefined()
  })

  it('exempts subscribed articles from author grouping', async () => {
    const f = setup()
    f.subscribed.add(publicationUri)
    await f.timeline.hydrate([documentUri])
    expect(f.timeline.activity(documentUri, now)).toMatchObject({
      groupable: false,
      item: { viewerState: { subscribed: true } },
    })
  })

  it('does not claim absent subscriptions are false when actor backlinks truncate', async () => {
    const f = setup()
    f.setTruncated(true)
    await f.timeline.hydrate([documentUri])
    expect(f.timeline.activity(documentUri, now)).toMatchObject({
      groupable: false,
      item: { viewerState: { subscribed: false } },
    })
  })

  it('keeps articles visible and ungrouped when subscription lookup fails', async () => {
    const f = setup()
    using failure = vi
      .spyOn(f.hydrator.external, 'getAtmosphereBacklinksByActor')
      .mockRejectedValueOnce(new Error('subscription lookup unavailable'))
    await f.timeline.hydrate([documentUri])
    expect(f.timeline.activity(documentUri, now)).toMatchObject({
      groupable: false,
      item: {
        viewerState: { subscribed: false },
        view: { title: 'Article' },
      },
    })

    await f.timeline.hydrate([recommendUri])
    expect(f.timeline.activity(recommendUri, now)).toMatchObject({
      target: documentUri,
      item: { view: { title: 'Article' } },
    })
    expect(f.timeline.activity(documentUri, now)?.groupable).toBe(false)
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('batches viewer subscription lookups at 100 targets', async () => {
    const f = setup()
    const roots = Array.from({ length: 205 }, (_, i) => {
      const publication = atUri(
        publisher,
        site.standard.publication.$type,
        `pub${i}`,
      )
      const document = atUri(author, site.standard.document.$type, `doc${i}`)
      f.records.set(
        publication,
        site.standard.publication.$build({
          name: 'Publication',
          url: 'https://example.com',
        }),
      )
      f.records.set(
        document,
        site.standard.document.$build({
          title: 'Article',
          site: publication,
          publishedAt: createdAt,
        }),
      )
      return document
    })
    await f.timeline.hydrate(roots)
    expect(f.subscriptionCalls.map((batch) => batch.length)).toEqual([
      100, 100, 5,
    ])
  })

  it('preserves shared seen state across incremental hydration, including missing targets', async () => {
    const f = setup()
    await f.timeline.hydrate([recommendUri])
    await f.timeline.hydrate([documentUri, recommendUri, subscriptionUri])
    expect(f.timeline.activity(documentUri, now)).toBeDefined()
    expect(
      f.lookupCalls.flat().filter((uri) => uri === documentUri),
    ).toHaveLength(1)
    expect(
      f.lookupCalls.flat().filter((uri) => uri === publicationUri),
    ).toHaveLength(1)
    expect(f.subscriptionCalls).toHaveLength(1)
    const missing = atUri(author, site.standard.document.$type, 'missing')
    await f.timeline.hydrate([missing])
    await f.timeline.hydrate([missing])
    expect(f.lookupCalls.flat().filter((uri) => uri === missing)).toHaveLength(
      1,
    )
  })

  it('uses the real post hydrator for article shares and never author-groups them', async () => {
    const f = setup()
    await f.timeline.hydrate([postUri])
    expect(f.timeline.activity(postUri, now)).toMatchObject({
      target: documentUri,
      groupable: false,
      item: {
        view: {
          $type: app.bsky.feed.defs.postView.$type,
          uri: postUri,
          record: { text: 'Read this' },
        },
      },
    })
    await f.timeline.hydrate([postUri])
    expect(f.postCalls.flat()).toEqual([postUri])
  })

  it('does not guess an article association from an external URL', async () => {
    const f = setup()
    f.records.set(
      postUri,
      app.bsky.feed.post.$build({
        text: 'Read this',
        createdAt,
        embed: app.bsky.embed.external.$build({
          external: {
            uri: 'https://example.com/article',
            title: 'Article',
            description: '',
          },
        }),
      }),
    )
    await f.timeline.hydrate([postUri])
    expect(f.timeline.activity(postUri, now)).toBeUndefined()
    expect(f.lookupCalls.flat()).not.toContain(documentUri)
  })

  it('filters shares when the required pinned article is muted', async () => {
    const f = setup()
    f.muted.add(author)
    await f.timeline.hydrate([postUri])
    expect(f.timeline.activity(postUri, now)).toBeUndefined()
  })

  it.each([
    [recommendUri, documentUri],
    [subscriptionUri, publicationUri],
    [favoriteUri, galleryUri],
  ])('requires an available target for %s', async (root, target) => {
    const f = setup()
    f.records.delete(target)
    await f.timeline.hydrate([root])
    expect(f.timeline.activity(root, now)).toBeUndefined()
  })

  it('filters an action whose own author is muted', async () => {
    const f = setup()
    f.muted.add(reader)
    await f.timeline.hydrate([recommendUri])
    expect(f.timeline.activity(recommendUri, now)).toBeUndefined()
    expect(f.timeline.profile(reader)).toBeUndefined()
  })

  it('does not render empty galleries after required photos are moderated', async () => {
    const f = setup()
    f.hidden.add(photoUri)
    await f.timeline.hydrate([galleryUri, favoriteUri])
    expect(f.timeline.activity(galleryUri, now)).toBeUndefined()
    expect(f.timeline.activity(favoriteUri, now)).toBeUndefined()
  })

  it('allows author grouping for finished streams and unsubscribed articles', async () => {
    const f = setup()
    f.records.set(
      streamUri,
      place.stream.livestream.$build({
        title: 'Stream',
        url: 'https://stream.place/author',
        createdAt,
        endedAt: createdAt,
      }),
    )
    await f.timeline.hydrate([streamUri, documentUri])
    expect(f.timeline.activity(streamUri, now)?.groupable).toBe(true)
    expect(f.timeline.activity(documentUri, now)?.groupable).toBe(true)
    expect(
      f.timeline.activity(documentUri, now)?.item.viewerState.subscribed,
    ).toBe(false)
  })
})
