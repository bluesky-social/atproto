import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import * as HomeFeed from '../../src/lexicon/types/app/bsky/getHomeFeed'
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
    const expectOriginatorFollowedBy = (did) => (item: HomeFeed.FeedItem) => {
      const originator = getOriginator(item)
      if (did === originator) {
        // The user sees their own posts, but the user does not expect to see their reposts
        return expect(item.repostedBy?.did).not.toEqual(did)
      }
      // Otherwise, we expect that the user follows the originator of the post
      expect(sc.follows[did]).toHaveProperty(originator)
    }

    const aliceFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceFeed.data.feed)).toMatchSnapshot()
    aliceFeed.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobFeed.data.feed)).toMatchSnapshot()
    bobFeed.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolFeed.data.feed)).toMatchSnapshot()
    carolFeed.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danFeed.data.feed)).toMatchSnapshot()
    danFeed.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ firehose algorithm", async () => {
    const expectNotOwnRepostsBy = (did) => (item: HomeFeed.FeedItem) => {
      const originator = getOriginator(item)
      if (did === originator) {
        // The user sees their own posts, but the user does not expect to see their reposts
        return expect(item.repostedBy?.did).not.toEqual(did)
      }
    }

    const aliceFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceFeed.data.feed)).toMatchSnapshot()
    aliceFeed.data.feed.forEach(expectNotOwnRepostsBy(alice))

    const carolFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolFeed.data.feed)).toMatchSnapshot()
    carolFeed.data.feed.forEach(expectNotOwnRepostsBy(carol))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultFeed = await client.app.bsky.getHomeFeed(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )
    const reverseChronologicalFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultFeed.data.feed).toEqual(reverseChronologicalFeed.data.feed)
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.getHomeFeed(
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

    const full = await client.app.bsky.getHomeFeed(
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
      const res = await client.app.bsky.getHomeFeed(
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

    const full = await client.app.bsky.getHomeFeed(
      {
        algorithm: FeedAlgorithm.Firehose,
      },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.feed.length).toEqual(13)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
