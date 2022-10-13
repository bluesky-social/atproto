import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import {
  runTestServer,
  forSnapshot,
  getCursors,
  getSortedCursors,
  CloseFn,
  getOriginator,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/api/app/bsky/util/feed'
import { AppBskyGetHomeFeedFeedItem as FeedItem } from '@adxp/api/src/types/app/bsky/getHomeFeed'

describe('pds home feed views', () => {
  let client: AdxServiceClient
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
    client = AdxApi.service(server.url)
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
    const expectOriginatorFollowedBy = (did) => (item: FeedItem) => {
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
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceFeed.data.feed)).toMatchSnapshot()
    aliceFeed.data.feed.forEach(expectOriginatorFollowedBy(alice))
    expect(getCursors(aliceFeed.data.feed)).toEqual(
      getSortedCursors(aliceFeed.data.feed),
    )

    const bobFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobFeed.data.feed)).toMatchSnapshot()
    bobFeed.data.feed.forEach(expectOriginatorFollowedBy(bob))
    expect(getCursors(bobFeed.data.feed)).toEqual(
      getSortedCursors(bobFeed.data.feed),
    )

    const carolFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolFeed.data.feed)).toMatchSnapshot()
    carolFeed.data.feed.forEach(expectOriginatorFollowedBy(carol))
    expect(getCursors(carolFeed.data.feed)).toEqual(
      getSortedCursors(carolFeed.data.feed),
    )

    const danFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danFeed.data.feed)).toMatchSnapshot()
    danFeed.data.feed.forEach(expectOriginatorFollowedBy(dan))
    expect(getCursors(danFeed.data.feed)).toEqual(
      getSortedCursors(danFeed.data.feed),
    )
  })

  it("fetches authenticated user's home feed w/ firehose algorithm", async () => {
    const expectNotOwnRepostsBy = (did) => (item: FeedItem) => {
      const originator = getOriginator(item)
      if (did === originator) {
        // The user sees their own posts, but the user does not expect to see their reposts
        return expect(item.repostedBy?.did).not.toEqual(did)
      }
    }

    const aliceFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceFeed.data.feed)).toMatchSnapshot()
    aliceFeed.data.feed.forEach(expectNotOwnRepostsBy(alice))
    expect(getCursors(aliceFeed.data.feed)).toEqual(
      getSortedCursors(aliceFeed.data.feed),
    )

    const carolFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolFeed.data.feed)).toMatchSnapshot()
    carolFeed.data.feed.forEach(expectNotOwnRepostsBy(carol))
    expect(getCursors(carolFeed.data.feed)).toEqual(
      getSortedCursors(carolFeed.data.feed),
    )
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultFeed = await client.app.bsky.getHomeFeed({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const reverseChronologicalFeed = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultFeed.data.feed).toEqual(reverseChronologicalFeed.data.feed)
  })

  it('paginates reverse-chronological feed', async () => {
    const full = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(full.data.feed.length).toEqual(6)

    const paginated = await client.app.bsky.getHomeFeed(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        before: full.data.feed[1].cursor,
        limit: 2,
      },
      undefined,
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(paginated.data.feed).toEqual(full.data.feed.slice(2, 4))
  })

  it('paginates firehose feed', async () => {
    const full = await client.app.bsky.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(full.data.feed.length).toEqual(13)

    const paginated = await client.app.bsky.getHomeFeed(
      {
        algorithm: FeedAlgorithm.Firehose,
        before: full.data.feed[1].cursor,
        limit: 2,
      },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(paginated.data.feed).toEqual(full.data.feed.slice(2, 4))
  })
})
