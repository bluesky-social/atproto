import assert from 'node:assert'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AppBskyFeedDefs,
  type AppBskyFeedGetTimeline,
  type AtpAgent,
  ids,
} from '@atproto/api'
import {
  EXAMPLE_LABELER,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { Database } from '../../src/index.js'
import { forSnapshot, getOriginator, paginateAll } from '../_util.js'

const REVERSE_CHRON = 'reverse-chronological'

describe('timeline views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_home_feed',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // covers label hydration on embeds
    const { db } = network.bsky
    await createLabel(db, {
      val: 'test-label-3',
      uri: sc.posts[bob][0].ref.uriStr,
      cid: sc.posts[bob][0].ref.cidStr,
    })
    await createLabel(db, {
      val: 'test-label-3',
      uri: sc.posts[carol][0].ref.uriStr,
      cid: sc.posts[carol][0].ref.cidStr,
    })
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  // @TODO(bsky) blocks posts, reposts, replies by actor takedown via labels
  // @TODO(bsky) blocks posts, reposts, replies by record takedown via labels

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy =
      (did: string) => (item: AppBskyFeedDefs.FeedViewPost) => {
        const originator = getOriginator(item as any)
        // The user expects to see posts & reposts from themselves and follows
        if (did !== originator) {
          expect(sc.follows[did]).toHaveProperty(originator)
        }
      }

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(bob, ids.AppBskyFeedGetTimeline),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(dan, ids.AppBskyFeedGetTimeline),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results: AppBskyFeedGetTimeline.OutputSchema[]) =>
      results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: REVERSE_CHRON,
          cursor,
          limit: 4,
        },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetTimeline,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(4),
    )
    expect(paginatedAll[0].cursor).toBeDefined()
    expect(paginatedAll.at(-1)?.cursor).toBeUndefined()

    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: REVERSE_CHRON,
      },
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))

    const exact = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: carol,
      limit: 7,
    })
    const nonterminal = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: carol,
      limit: 4,
    })
    expect(exact.items).toHaveLength(7)
    expect(exact.cursor).toBe('')
    expect(nonterminal.items).toHaveLength(4)
    expect(nonterminal.cursor).not.toBe('')
  })

  it('returns an empty page when there are no posts', async () => {
    const viewer = await sc.createAccount('tl-empty-page', {
      handle: 'tl-empty-page.test',
      email: 'tl-empty-page@example.com',
      password: 'hunter2',
    })

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(0)
    expect(page.cursor).toBe('')
  })

  it('returns all own posts when there are fewer than the requested limit', async () => {
    const viewer = await sc.createAccount('tl-own-page', {
      handle: 'tl-own-page.test',
      email: 'tl-own-page@example.com',
      password: 'hunter2',
    })
    for (let i = 0; i < 15; i++) {
      await sc.post(viewer.did, `own timeline post ${i}`)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(15)
    expect(page.cursor).toBe('')
  })

  it('returns no cursor when own posts exactly fill the requested limit', async () => {
    const viewer = await sc.createAccount('tl-own-exact', {
      handle: 'tl-own-exact.test',
      email: 'tl-own-exact@example.com',
      password: 'hunter2',
    })
    for (let i = 0; i < 20; i++) {
      await sc.post(viewer.did, `exact own timeline post ${i}`)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(20)
    expect(page.cursor).toBe('')
  })

  it('returns a cursor when own posts exceed the requested limit', async () => {
    const viewer = await sc.createAccount('tl-own-overflow', {
      handle: 'tl-own-overflow.test',
      email: 'tl-own-overflow@example.com',
      password: 'hunter2',
    })
    const postUris = new Set<string>()
    for (let i = 0; i < 21; i++) {
      const post = await sc.post(viewer.did, `overflow own timeline post ${i}`)
      postUris.add(post.ref.uriStr)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(20)
    expect(page.cursor).not.toBe('')

    const nextPage = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
      cursor: page.cursor,
    })
    expect(nextPage.items).toHaveLength(1)
    expect(nextPage.cursor).toBe('')
    expect(
      new Set([...page.items, ...nextPage.items].map((item) => item.uri)),
    ).toEqual(postUris)
  })

  it('uses own posts to fill space without displacing followed-account posts', async () => {
    const viewer = await sc.createAccount('tl-own-fill', {
      handle: 'tl-own-fill.test',
      email: 'tl-own-fill@example.com',
      password: 'hunter2',
    })
    const author = await sc.createAccount('tl-follow-fill', {
      handle: 'tl-follow-fill.test',
      email: 'tl-follow-fill@example.com',
      password: 'hunter2',
    })
    await sc.follow(viewer.did, author.did)
    const followedPostUris: string[] = []
    for (let i = 0; i < 5; i++) {
      const post = await sc.post(author.did, `followed timeline post ${i}`)
      followedPostUris.push(post.ref.uriStr)
    }
    const ownPostUris: string[] = []
    for (let i = 0; i < 20; i++) {
      const post = await sc.post(viewer.did, `own fill timeline post ${i}`)
      ownPostUris.push(post.ref.uriStr)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(20)
    expect(page.cursor).not.toBe('')
    const returnedUris = new Set(page.items.map((item) => item.uri))
    expect(followedPostUris.every((uri) => returnedUris.has(uri))).toBe(true)
    expect(ownPostUris.filter((uri) => returnedUris.has(uri))).toHaveLength(15)
  })

  it('returns no cursor when followed-account and own posts exactly fill the requested limit', async () => {
    const viewer = await sc.createAccount('tl-mixed-exact', {
      handle: 'tl-mixed-exact.test',
      email: 'tl-mixed-exact@example.com',
      password: 'hunter2',
    })
    const author = await sc.createAccount('tl-mixed-author', {
      handle: 'tl-mixed-author.test',
      email: 'tl-mixed-author@example.com',
      password: 'hunter2',
    })
    await sc.follow(viewer.did, author.did)
    for (let i = 0; i < 5; i++) {
      await sc.post(author.did, `exact followed timeline post ${i}`)
    }
    for (let i = 0; i < 15; i++) {
      await sc.post(viewer.did, `exact own fill timeline post ${i}`)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(20)
    expect(page.cursor).toBe('')
  })

  it('caps own posts at 10 when followed-account posts can fill the page', async () => {
    const viewer = await sc.createAccount('tl-own-cap', {
      handle: 'tl-own-cap.test',
      email: 'tl-own-cap@example.com',
      password: 'hunter2',
    })
    const author = await sc.createAccount('tl-cap-author', {
      handle: 'tl-cap-author.test',
      email: 'tl-cap-author@example.com',
      password: 'hunter2',
    })
    await sc.follow(viewer.did, author.did)
    const followedPostUris = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const post = await sc.post(author.did, `capped followed post ${i}`)
      followedPostUris.add(post.ref.uriStr)
    }
    const ownPostUris = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const post = await sc.post(viewer.did, `capped own post ${i}`)
      ownPostUris.add(post.ref.uriStr)
    }
    await network.processAll()

    const page = await network.bsky.ctx.dataplane.getTimeline({
      actorDid: viewer.did,
      limit: 20,
    })

    expect(page.items).toHaveLength(20)
    expect(page.cursor).not.toBe('')
    expect(page.items.filter((item) => ownPostUris.has(item.uri))).toHaveLength(
      10,
    )
    expect(
      page.items.filter((item) => followedPostUris.has(item.uri)),
    ).toHaveLength(10)
  })

  it('fills a limited timeline after an entirely filtered page', async () => {
    const viewer = await sc.createAccount('timeline-page-fill-viewer', {
      handle: 'tl-fill-viewer.test',
      email: 'timeline-page-fill-viewer@example.com',
      password: 'hunter2',
    })
    const author = await sc.createAccount('timeline-page-fill-author', {
      handle: 'tl-fill-author.test',
      email: 'timeline-page-fill-author@example.com',
      password: 'hunter2',
    })
    await sc.follow(viewer.did, author.did)
    const older = await sc.post(
      author.did,
      'older visible timeline post',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-03-01T00:00:00.000Z' },
    )
    const newer = await sc.post(
      author.did,
      'newer visible timeline post',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-03-02T00:00:00.000Z' },
    )
    const filtered1 = await sc.post(
      author.did,
      'filtered timeline post 1',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-03-03T00:00:00.000Z' },
    )
    const filtered2 = await sc.post(
      author.did,
      'filtered timeline post 2',
      undefined,
      undefined,
      undefined,
      { createdAt: '2030-03-04T00:00:00.000Z' },
    )
    await network.processAll()
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: filtered1.ref.uriStr,
    })
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: filtered2.ref.uriStr,
    })

    const { data } = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON, limit: 2 },
      {
        headers: await network.serviceHeaders(
          viewer.did,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(data.feed.map((item) => item.post.uri)).toEqual([
      newer.ref.uriStr,
      older.ref.uriStr,
    ])
    expect(data.cursor).toBeUndefined()
  })

  it('agrees what the first item is for limit=1 and other limits', async () => {
    const { data: timeline } = await agent.api.app.bsky.feed.getTimeline(
      { limit: 10 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    const { data: timelineLimit1 } = await agent.api.app.bsky.feed.getTimeline(
      { limit: 1 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    expect(timeline.feed.length).toBeGreaterThan(1)
    expect(timelineLimit1.feed.length).toEqual(1)
    expect(timelineLimit1.feed[0].post.uri).toBe(timeline.feed[0].post.uri)
  })

  it('reflects self-labels', async () => {
    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: await network.serviceHeaders(
          carol,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    const alicePost = carolTL.data.feed.find(
      ({ post }) => post.uri === sc.posts[alice][0].ref.uriStr,
    )?.post

    assert(alicePost, 'post does not exist')

    const postSelfLabels = alicePost.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)

    expect(postSelfLabels).toEqual(['self-label'])

    const authorSelfLabels = alicePost.author.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)
      .sort()

    expect(authorSelfLabels).toEqual(['self-label-a', 'self-label-b'])
  })

  it('blocks posts, reposts, replies by actor takedown', async () => {
    await Promise.all(
      [bob, carol].map((did) =>
        network.bsky.ctx.dataplane.takedownActor({ did }),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      [bob, carol].map((did) =>
        network.bsky.ctx.dataplane.untakedownActor({ did }),
      ),
    )
  })

  it('blocks posts, reposts, replies by record takedown.', async () => {
    const postRef1 = sc.posts[dan][1].ref // Repost
    const postRef2 = sc.replies[bob][0].ref // Post and reply parent
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.takedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.untakedownRecord({
          recordUri: postRef.uriStr,
        }),
      ),
    )
  })

  it('fails open on clearly bad cursor.', async () => {
    const { data: timeline } = await agent.api.app.bsky.feed.getTimeline(
      { cursor: '90210::bafycid' },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )
    expect(timeline).toEqual({ feed: [] })
  })
})

const createLabel = async (
  db: Database,
  opts: { uri: string; cid: string; val: string },
) => {
  await db.db
    .insertInto('label')
    .values({
      uri: opts.uri,
      cid: opts.cid,
      val: opts.val,
      cts: new Date().toISOString(),
      exp: null,
      neg: false,
      src: EXAMPLE_LABELER,
    })
    .execute()
}
