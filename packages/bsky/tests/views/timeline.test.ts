import assert from 'assert'
import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { forSnapshot, getOriginator, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/api/app/bsky/util/feed'
import { FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'

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
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // Label posts as "kind" to check labels on embed views
    const labelPostA = sc.posts[bob][0].ref
    const labelPostB = sc.posts[carol][0].ref
    await network.bsky.ctx.services
      .label(network.bsky.ctx.db.getPrimary())
      .formatAndCreate(
        network.bsky.ctx.cfg.labelerDid,
        labelPostA.uriStr,
        labelPostA.cidStr,
        { create: ['kind'] },
      )
    await network.bsky.ctx.services
      .label(network.bsky.ctx.db.getPrimary())
      .formatAndCreate(
        network.bsky.ctx.cfg.labelerDid,
        labelPostB.uriStr,
        labelPostB.cidStr,
        { create: ['kind'] },
      )
    await network.bsky.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  // @TODO(bsky) blocks posts, reposts, replies by actor takedown via labels
  // @TODO(bsky) blocks posts, reposts, replies by record takedown via labels

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
        headers: await network.serviceHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await network.serviceHeaders(bob),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await network.serviceHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await network.serviceHeaders(dan),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: await network.serviceHeaders(alice),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await network.serviceHeaders(alice),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
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
        { headers: await network.serviceHeaders(carol) },
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
      { headers: await network.serviceHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('reflects self-labels', async () => {
    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: await network.serviceHeaders(carol) },
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
            headers: network.pds.adminAuthHeaders(),
          },
        ),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: await network.serviceHeaders(alice) },
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
            headers: network.pds.adminAuthHeaders(),
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
            headers: network.pds.adminAuthHeaders(),
          },
        ),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: await network.serviceHeaders(alice) },
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
            headers: network.pds.adminAuthHeaders(),
          },
        ),
      ),
    )
  })
})
