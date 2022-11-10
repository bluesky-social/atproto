import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import * as Timeline from '../../src/lexicon/types/app/bsky/feed/getTimeline'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  getOriginator,
  paginateAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/api/app/bsky/util/feed'

describe('pds home feed views', () => {
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
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy = (did) => (item: Timeline.FeedItem) => {
      const originator = getOriginator(item)
      if (did === originator) {
        // The user sees their own posts, but the user does not expect to see their reposts
        return expect(item.repostedBy?.did).not.toEqual(did)
      }
      // Otherwise, we expect that the user follows the originator of the post
      expect(sc.follows[did]).toHaveProperty(originator)
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

  it("fetches authenticated user's home feed w/ firehose algorithm", async () => {
    const expectNotOwnRepostsBy = (did) => (item: Timeline.FeedItem) => {
      const originator = getOriginator(item)
      if (did === originator) {
        // The user sees their own posts, but the user does not expect to see their reposts
        return expect(item.repostedBy?.did).not.toEqual(did)
      }
    }

    const aliceTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.Firehose },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectNotOwnRepostsBy(alice))

    const carolTL = await client.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.Firehose },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectNotOwnRepostsBy(carol))
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

    expect(full.data.feed.length).toEqual(6)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('paginates firehose feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.Firehose,
          before: cursor,
          limit: 5,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(5),
    )

    const full = await client.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.Firehose,
      },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.feed.length).toEqual(15)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
