import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import { Main as FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/feedViewPost'
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
import { FeedAlgorithm } from '../../src/api/app/bsky/util/feed'

describe('timeline views', () => {
  let client: AtpServiceClient
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
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, server.ctx.messageQueue)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
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

    const aliceTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await client.app.bsky.feed.getTimeline(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )
    const reverseChronologicalTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('omits posts and reposts of muted authors.', async () => {
    await client.app.bsky.graph.mute(
      { user: bob },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await client.app.bsky.graph.mute(
      { user: carol },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    await client.app.bsky.graph.unmute(
      { user: bob },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    await client.app.bsky.graph.unmute(
      { user: carol },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.ReverseChronological,
          before: cursor,
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

    const full = await client.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
      },
      { headers: sc.getHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocks posts, reposts, replies by actor takedown', async () => {
    await client.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.moderationAction#subjectRepo',
          did: bob,
        },
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
    await client.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.admin.moderationAction#subjectRepo',
          did: dan,
        },
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )

    const aliceTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
  })
})
