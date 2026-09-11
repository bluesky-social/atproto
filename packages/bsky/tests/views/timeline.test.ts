import assert from 'node:assert'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  type AppBskyFeedDefs,
  type AppBskyFeedGetTimeline,
  type AtpAgent,
  ids,
} from '@atproto/api'
import {
  EXAMPLE_LABELER,
  type RecordRef,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { Gate } from '../../src/feature-gates/gates.js'
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
    vi.spyOn(network.bsky.ctx.featureGatesClient, 'scope').mockImplementation(
      () => ({
        Gate,
        checkGate: (gate) => gate === Gate.KnownLikersFeedEnable,
        checkGates: (gates) =>
          new Map(
            gates.map((gate) => [gate, gate === Gate.KnownLikersFeedEnable]),
          ),
      }),
    )
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
    const carolPost = aliceTL.data.feed.find(
      (item) => item.post.uri === sc.posts[carol][0].ref.uriStr,
    )
    expect(
      carolPost?.post.viewer?.knownLikers?.actors.map((actor) => actor.did),
    ).toEqual([bob])
    expect(carolPost?.post.viewer?.knownLikers?.count).toBe(1)

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

  it('serves known likers on the root post of a reply, not on the reply itself', async () => {
    const { data } = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON, limit: 100 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetTimeline,
        ),
      },
    )

    // Bob replies directly to alice's post, so the reply's parent is its root.
    const item = data.feed.find(
      (item) => item.post.uri === sc.replies[bob][0].ref.uriStr,
    )
    assert(item, 'expected bob reply in timeline')
    assert(item.reply, 'expected reply context')

    const root = item.reply.root as AppBskyFeedDefs.PostView
    const parent = item.reply.parent as AppBskyFeedDefs.PostView
    expect(root.uri).toBe(sc.posts[alice][1].ref.uriStr)
    expect(parent.uri).toBe(root.uri)

    const likers = [bob, carol, dan]
    expect(root.viewer?.knownLikers?.count).toBe(likers.length)
    expect(root.viewer?.knownLikers?.actors.map((a) => a.did).sort()).toEqual(
      [...likers].sort(),
    )
    expect(parent.viewer?.knownLikers).toEqual(root.viewer?.knownLikers)
    expect(item.post.viewer?.knownLikers).toBeUndefined()
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

  describe('bounded by since', () => {
    let viewer: DidString
    let author: DidString
    /** Posts present when `startCursor` was captured, oldest first. */
    let initial: RecordRef[]
    /** Posts made after `startCursor` was captured, oldest first. */
    let subsequent: RecordRef[]
    /** Start cursor of the timeline as it stood before `subsequent` existed. */
    let startCursor: string

    const fetchTimeline = async (
      did: string,
      params: AppBskyFeedGetTimeline.QueryParams,
    ) => {
      const { data } = await agent.api.app.bsky.feed.getTimeline(params, {
        headers: await network.serviceHeaders(did, ids.AppBskyFeedGetTimeline),
      })
      return data
    }

    /*
     * sortAt is the lesser of createdAt and indexedAt, so backdating pins it to
     * createdAt and makes the order these tests bracket deterministic.
     */
    const postAt = async (did: DidString, text: string, createdAt: string) => {
      const post = await sc.post(did, text, undefined, undefined, undefined, {
        createdAt,
      })
      return post.ref
    }

    beforeAll(async () => {
      const viewerAccount = await sc.createAccount('tl-since-viewer', {
        handle: 'tl-since-viewer.test',
        email: 'tl-since-viewer@example.com',
        password: 'hunter2',
      })
      const authorAccount = await sc.createAccount('tl-since-author', {
        handle: 'tl-since-author.test',
        email: 'tl-since-author@example.com',
        password: 'hunter2',
      })
      viewer = viewerAccount.did
      author = authorAccount.did
      await sc.follow(viewer, author)

      initial = [
        await postAt(author, 'since initial 1', '2023-01-01T00:00:00.000Z'),
        await postAt(author, 'since initial 2', '2023-01-02T00:00:00.000Z'),
        await postAt(author, 'since initial 3', '2023-01-03T00:00:00.000Z'),
      ]
      await network.processAll()

      const before = await fetchTimeline(viewer, {})
      assert(before.startCursor, 'expected a start cursor')
      startCursor = before.startCursor

      subsequent = [
        await postAt(author, 'since subsequent 1', '2023-02-01T00:00:00.000Z'),
        await postAt(author, 'since subsequent 2', '2023-02-02T00:00:00.000Z'),
      ]
      await network.processAll()
    })

    it('returns a start cursor identifying the newest item of the page', async () => {
      const page = await fetchTimeline(viewer, {})
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
        initial[2].uriStr,
        initial[1].uriStr,
        initial[0].uriStr,
      ])
      assert(page.startCursor, 'expected a start cursor')

      /*
       * The bound is exclusive, so a start cursor is pinned to a position by
       * what it excludes: bounding by the second page's start cursor returns
       * exactly the items above that page, and none of the page itself.
       */
      const first = await fetchTimeline(viewer, { limit: 2 })
      assert(first.cursor, 'expected a cursor')
      const second = await fetchTimeline(viewer, {
        limit: 2,
        cursor: first.cursor,
      })
      expect(second.feed.map((item) => item.post.uri)).toEqual([
        initial[2].uriStr,
        initial[1].uriStr,
      ])
      assert(second.startCursor, 'expected a start cursor')

      const above = await fetchTimeline(viewer, { since: second.startCursor })
      expect(above.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
    })

    it('returns everything newer than since, echoing the cursor once exhausted', async () => {
      const page = await fetchTimeline(viewer, { since: startCursor })

      // The item at the boundary is not re-delivered: the bound is exclusive.
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
      expect(page.cursor).toBe(startCursor)
      expect(page.startCursor).not.toBe(startCursor)
      assert(page.startCursor, 'expected a start cursor')
    })

    it('returns nothing when since is the newest position the caller holds', async () => {
      const page = await fetchTimeline(viewer, {})
      assert(page.startCursor, 'expected a start cursor')

      /*
       * `since` names an item the caller already holds, so bounding by the
       * newest position it knows about leaves nothing to return. The cursor is
       * still echoed back rather than emptied, so the caller can keep
       * paginating below the boundary.
       */
      const bounded = await fetchTimeline(viewer, { since: page.startCursor })
      expect(bounded.feed).toEqual([])
      expect(bounded.cursor).toBe(page.startCursor)
    })

    it('returns a normal cursor while the bounded range still has more', async () => {
      const page = await fetchTimeline(viewer, { since: startCursor, limit: 1 })
      expect(page.feed.map((item) => item.post.uri)).toEqual([
        subsequent[1].uriStr,
      ])
      assert(page.cursor, 'expected a cursor')
      expect(page.cursor).not.toBe(startCursor)

      const next = await fetchTimeline(viewer, {
        since: startCursor,
        cursor: page.cursor,
        limit: 1,
      })
      expect(next.feed.map((item) => item.post.uri)).toEqual([
        subsequent[0].uriStr,
      ])
      expect(next.cursor).toBe(startCursor)
    })

    it('rejects a malformed since with a 400', async () => {
      const promise = fetchTimeline(viewer, { since: 'garbage' })
      await expect(promise).rejects.toMatchObject({
        status: 400,
        error: 'InvalidRequest',
      })
    })

    it('echoes since when a legacy cursor short-circuits the read', async () => {
      /*
       * A v1-format cursor is answered with an empty page without consulting
       * the dataplane, but a `since` request must still not come back with an
       * empty cursor.
       */
      const page = await fetchTimeline(viewer, {
        since: startCursor,
        cursor: '1234567890123::bafyabc',
      })
      expect(page.feed).toEqual([])
      expect(page.cursor).toBe(startCursor)
    })

    it('bounds the viewer own posts as well as followed accounts', async () => {
      const selfViewer = await sc.createAccount('tl-since-self-viewer', {
        handle: 'tl-since-self-v.test',
        email: 'tl-since-self-viewer@example.com',
        password: 'hunter2',
      })
      const selfAuthor = await sc.createAccount('tl-since-self-author', {
        handle: 'tl-since-self-a.test',
        email: 'tl-since-self-author@example.com',
        password: 'hunter2',
      })
      await sc.follow(selfViewer.did, selfAuthor.did)
      const selfBelow = await postAt(
        selfViewer.did,
        'since self below',
        '2023-04-01T00:00:00.000Z',
      )
      // Anchors the start cursor above the viewer's own earlier post.
      await postAt(
        selfAuthor.did,
        'since self boundary',
        '2023-04-02T00:00:00.000Z',
      )
      await network.processAll()

      const before = await fetchTimeline(selfViewer.did, {})
      assert(before.startCursor, 'expected a start cursor')

      const selfAbove = await postAt(
        selfViewer.did,
        'since self above',
        '2023-04-03T00:00:00.000Z',
      )
      const authorAbove = await postAt(
        selfAuthor.did,
        'since self author above',
        '2023-04-04T00:00:00.000Z',
      )
      await network.processAll()

      // Own posts are merged in from a sub-query of their own, which the bound
      // has to reach as well.
      const page = await fetchTimeline(selfViewer.did, {
        since: before.startCursor,
      })
      const uris = page.feed.map((item) => item.post.uri)
      expect(uris).toEqual([authorAbove.uriStr, selfAbove.uriStr])
      expect(uris).not.toContain(selfBelow.uriStr)
      expect(page.cursor).toBe(before.startCursor)
    })

    it('keeps the echoed cursor when the bounded page is short after filtering', async () => {
      const boundedViewer = await sc.createAccount('tl-since-flt-viewer', {
        handle: 'tl-since-flt-v.test',
        email: 'tl-since-flt-viewer@example.com',
        password: 'hunter2',
      })
      const boundedAuthor = await sc.createAccount('tl-since-flt-author', {
        handle: 'tl-since-flt-a.test',
        email: 'tl-since-flt-author@example.com',
        password: 'hunter2',
      })
      await sc.follow(boundedViewer.did, boundedAuthor.did)
      // Anchors the start cursor the bounded read is later bounded by.
      await postAt(
        boundedAuthor.did,
        'since filtered boundary',
        '2023-03-01T00:00:00.000Z',
      )
      await network.processAll()

      const before = await fetchTimeline(boundedViewer.did, {})
      assert(before.startCursor, 'expected a start cursor')

      const hidden = [
        await postAt(
          boundedAuthor.did,
          'since filtered 1',
          '2023-03-02T00:00:00.000Z',
        ),
        await postAt(
          boundedAuthor.did,
          'since filtered 2',
          '2023-03-03T00:00:00.000Z',
        ),
      ]
      const visible = await postAt(
        boundedAuthor.did,
        'since filtered visible',
        '2023-03-04T00:00:00.000Z',
      )
      await network.processAll()
      await Promise.all(
        hidden.map((ref) =>
          network.bsky.ctx.dataplane.takedownRecord({ recordUri: ref.uriStr }),
        ),
      )

      // The page comes back under-filled, which would normally trigger a
      // refill; the echoed cursor has to survive that.
      const page = await fetchTimeline(boundedViewer.did, {
        since: before.startCursor,
        limit: 3,
      })
      expect(page.feed.map((item) => item.post.uri)).toEqual([visible.uriStr])
      expect(page.cursor).toBe(before.startCursor)
    })

    it('bounds the dataplane page exclusively', async () => {
      const page = await network.bsky.ctx.dataplane.getTimeline({
        actorDid: viewer,
        limit: 10,
        since: startCursor,
      })
      expect(page.items.map((item) => item.uri)).toEqual([
        subsequent[1].uriStr,
        subsequent[0].uriStr,
      ])
      expect(page.cursor).toBe(startCursor)
      expect(page.startCursor).not.toBe('')
      expect(page.startCursor).not.toBe(startCursor)

      const partial = await network.bsky.ctx.dataplane.getTimeline({
        actorDid: viewer,
        limit: 1,
        since: startCursor,
      })
      expect(partial.items).toHaveLength(1)
      expect(partial.cursor).not.toBe('')
      expect(partial.cursor).not.toBe(startCursor)
    })

    describe('with the top of the bounded range taken down', () => {
      let refillViewer: DidString
      /** Post at the boundary the bounded reads below are bounded by. */
      let boundary: RecordRef
      /** Taken-down posts sitting above `visible`, newest last. */
      let hidden: RecordRef[]
      /** The only renderable post above the boundary. */
      let visible: RecordRef
      let since: string

      beforeAll(async () => {
        const viewerAccount = await sc.createAccount('tl-since-refill-viewer', {
          handle: 'tl-since-rf-v.test',
          email: 'tl-since-refill-viewer@example.com',
          password: 'hunter2',
        })
        const authorAccount = await sc.createAccount('tl-since-refill-author', {
          handle: 'tl-since-rf-a.test',
          email: 'tl-since-refill-author@example.com',
          password: 'hunter2',
        })
        refillViewer = viewerAccount.did
        await sc.follow(refillViewer, authorAccount.did)
        boundary = await postAt(
          authorAccount.did,
          'since refill boundary',
          '2023-05-01T00:00:00.000Z',
        )
        await network.processAll()

        const before = await fetchTimeline(refillViewer, {})
        assert(before.startCursor, 'expected a start cursor')
        since = before.startCursor

        visible = await postAt(
          authorAccount.did,
          'since refill visible',
          '2023-05-02T00:00:00.000Z',
        )
        hidden = [
          await postAt(
            authorAccount.did,
            'since refill hidden 1',
            '2023-05-03T00:00:00.000Z',
          ),
          await postAt(
            authorAccount.did,
            'since refill hidden 2',
            '2023-05-04T00:00:00.000Z',
          ),
        ]
        await network.processAll()
        await Promise.all(
          hidden.map((ref) =>
            network.bsky.ctx.dataplane.takedownRecord({
              recordUri: ref.uriStr,
            }),
          ),
        )
      })

      it('refills within the bound rather than reading below it', async () => {
        /*
         * Both taken-down posts fill the first dataplane page, which therefore
         * comes back empty of renderable items and with a normal cursor: the
         * refill has to re-apply `since` to stay above the boundary.
         */
        const page = await fetchTimeline(refillViewer, { since, limit: 2 })
        const uris = page.feed.map((item) => item.post.uri)
        expect(uris).toEqual([visible.uriStr])
        expect(uris).not.toContain(boundary.uriStr)
        expect(page.cursor).toBe(since)
      })

      it('reports the newest dataplane row as the start cursor', async () => {
        const page = await fetchTimeline(refillViewer, { since, limit: 2 })
        assert(page.startCursor, 'expected a start cursor')
        expect(page.feed.map((item) => item.post.uri)).toEqual([visible.uriStr])

        // The newest row of the page is taken down, so the start cursor sits
        // above the first rendered item rather than on it.
        const rows = await network.bsky.ctx.dataplane.getTimeline({
          actorDid: refillViewer,
          limit: 2,
          since,
        })
        expect(rows.items[0].uri).toBe(hidden[1].uriStr)
        expect(page.startCursor).toBe(rows.startCursor)

        const above = await fetchTimeline(refillViewer, {
          since: page.startCursor,
        })
        expect(above.feed).toEqual([])
        expect(above.cursor).toBe(page.startCursor)
      })
    })
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
