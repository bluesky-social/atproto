import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  getOriginator,
  paginateAll,
  adminAuth,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/app-view/api/app/bsky/util/feed'

describe('timeline views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_home_feed',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // Label posts as "kind" to check labels on embed views
    const labelPostA = sc.posts[bob][0].ref
    const labelPostB = sc.posts[carol][0].ref
    await server.ctx.services.appView
      .label(server.ctx.db)
      .formatAndCreate(
        server.ctx.cfg.labelerDid,
        labelPostA.uriStr,
        labelPostA.cidStr,
        { create: ['kind'] },
      )
    await server.ctx.services.appView
      .label(server.ctx.db)
      .formatAndCreate(
        server.ctx.cfg.labelerDid,
        labelPostB.uriStr,
        labelPostB.cidStr,
        { create: ['kind'] },
      )
    await server.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy = (did) => (item: FeedViewPost) => {
      const originator = getOriginator(item)
      // The user expects to see posts & reposts from themselves and follows
      if (did !== originator) {
        expect(sc.follows[did]).toHaveProperty(originator)
      }
    }

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('full reverse-chronological feed', async () => {
    const fullNoArgs = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
      },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(fullNoArgs.data.feed.length).toEqual(13)

    const fullDefaultArgs = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeReplies: true,
        minReplyLikeCount: 0,
        includeReposts: true,
        includeQuotePosts: true,
      },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(fullDefaultArgs.data.feed.length).toEqual(
      fullNoArgs.data.feed.length,
    )
  })

  it('reverse-chronological feed, no reposts', async () => {
    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeReposts: false,
      },
      { headers: sc.getHeaders(alice) },
    )
    const POST_COUNT_NO_REPOSTS = 11
    expect(full.data.feed.length).toEqual(POST_COUNT_NO_REPOSTS)
  })

  it('reverse-chronological feed, no replies', async () => {
    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeReplies: false,
      },
      { headers: sc.getHeaders(alice) },
    )
    expect(full.data.feed.length).toEqual(10)
  })

  it('reverse-chronological feed, replies minimum like counts', async () => {
    const minReplyLikeCountOneFeed = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeReplies: true,
        minReplyLikeCount: 1,
      },
      { headers: sc.getHeaders(alice) },
    )
    expect(minReplyLikeCountOneFeed.data.feed.length).toEqual(10)

    const minReplyLikeCountTwentyFiveFeed =
      await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.ReverseChronological,
          includeReplies: true,
          minReplyLikeCount: 25,
        },
        { headers: sc.getHeaders(alice) },
      )
    expect(minReplyLikeCountTwentyFiveFeed.data.feed.length).toEqual(10)
    console.log(
      'feed',
      JSON.stringify(minReplyLikeCountTwentyFiveFeed.data.feed, null, 2),
    )
  })

  it('reverse-chronological feed, no quotes', async () => {
    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeQuotePosts: false,
      },
      { headers: sc.getHeaders(alice) },
    )
    expect(full.data.feed.length).toEqual(10)
  })

  it('reverse-chronological feed, no quotes, no replies, no reposts', async () => {
    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        includeQuotePosts: false,
        includeReplies: false,
        includeReposts: false,
      },
      { headers: sc.getHeaders(alice) },
    )
    expect(full.data.feed.length).toEqual(6)
  })

  it('omits posts and reposts of muted authors.', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: bob },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: carol },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: bob },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: carol },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.ReverseChronological,
          cursor,
          limit: 4,
        },
        { headers: sc.getHeaders(carol) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(4),
    )

    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
      },
      { headers: sc.getHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocks posts, reposts, replies by actor takedown', async () => {
    const actionResults = await Promise.all(
      [bob, carol].map((did) =>
        agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      actionResults.map((result) =>
        agent.api.com.atproto.admin.reverseModerationAction(
          {
            id: result.data.id,
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )
  })

  it('blocks posts, reposts, replies by record takedown.', async () => {
    const postRef1 = sc.posts[dan][1].ref // Repost
    const postRef2 = sc.replies[bob][0].ref // Post and reply parent
    const actionResults = await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef.uriStr,
              cid: postRef.cidStr,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      actionResults.map((result) =>
        agent.api.com.atproto.admin.reverseModerationAction(
          {
            id: result.data.id,
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        ),
      ),
    )
  })
})
