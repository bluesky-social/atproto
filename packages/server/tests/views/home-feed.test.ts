import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/api/todo/social/util'

describe('pds home feed views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await util.runTestServer()
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
    const aliceFeed = await client.todo.social.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[dan][1].text, // Repost
      sc.replies[alice][0].text,
      sc.replies[carol][0].text,
      sc.replies[bob][0].text,
      sc.posts[alice][2].text,
      sc.posts[bob][1].text,
      sc.posts[alice][1].text,
      sc.posts[dan][1].text, // Original post
      sc.posts[dan][0].text,
      sc.posts[carol][0].text,
      sc.posts[bob][0].text,
      sc.posts[alice][0].text,
    ])

    const toRepostInfo = (item) => ({
      repostCount: item.repostCount,
      repostedByName: item.repostedBy?.name,
    })

    expect(aliceFeed.data.feed.map(toRepostInfo)).toEqual([
      { repostCount: 1, repostedByName: 'carol.test' },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 1 },
      { repostCount: 1 },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 0 },
      { repostCount: 0 },
    ])

    const aliceFeed2 = await client.todo.social.getHomeFeed(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
        before: aliceFeed.data.feed[0].cursor,
        limit: 1,
      },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed2.data.feed.map((item) => item.record.text)).toEqual([
      sc.replies[alice][0].text,
    ])

    const bobFeed = await client.todo.social.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )

    /** @ts-ignore TODO */
    expect(bobFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[dan][1].text,
      sc.replies[alice][0].text,
      sc.replies[carol][0].text,
      sc.replies[bob][0].text,
      sc.posts[alice][2].text,
      sc.posts[bob][1].text,
      sc.posts[alice][1].text,
      sc.posts[carol][0].text,
      sc.posts[bob][0].text,
      sc.posts[alice][0].text,
    ])

    expect(bobFeed.data.feed[6].replyCount).toEqual(2)
    expect(bobFeed.data.feed[6].likeCount).toEqual(3)
    expect(bobFeed.data.feed[4].likeCount).toEqual(2)
    expect(bobFeed.data.feed[6]?.myState?.like).toEqual(
      sc.likes[bob][sc.posts[alice][1].uriRaw].toString(),
    )
    expect(bobFeed.data.feed[9]?.myState?.like).toBeUndefined()
  })

  it("fetches authenticated user's home feed w/ firehose algorithm", async () => {
    const aliceFeed = await client.todo.social.getHomeFeed(
      { algorithm: FeedAlgorithm.Firehose },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )

    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[dan][1].text, // Repost
      sc.replies[alice][0].text,
      sc.replies[carol][0].text,
      sc.replies[bob][0].text,
      sc.posts[alice][2].text,
      sc.posts[bob][1].text,
      sc.posts[alice][1].text, // Original post
      sc.posts[dan][1].text, // Original post
      sc.posts[dan][0].text,
      sc.posts[carol][0].text,
      sc.posts[bob][0].text,
      sc.posts[alice][0].text,
    ])

    const cursors = aliceFeed.data.feed.map((item) => item.cursor)
    const orderedCursors = [...cursors].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )

    expect(cursors).toEqual(orderedCursors)
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultFeed = await client.todo.social.getHomeFeed({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const reverseChronologicalFeed = await client.todo.social.getHomeFeed(
      { algorithm: FeedAlgorithm.ReverseChronological },
      undefined,
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultFeed.data.feed).toEqual(reverseChronologicalFeed.data.feed)
  })
})
