import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from './_util'
import { FeedAlgorithm } from '../src/api/todo/social/util'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

describe('pds views', () => {
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

  // @TODO test badges

  it('fetches liked by view', async () => {
    const view = await client.todo.social.getLikedBy({
      uri: sc.posts[alice][1].uriRaw,
    })
    expect(view.data.uri).toEqual(sc.posts[alice][1].uriRaw)
    expect(view.data.likedBy.length).toBe(3)
    const bobLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[bob].username,
    )
    expect(bobLike?.did).toEqual(bob)
    expect(bobLike?.displayName).toEqual(sc.profiles[bob].displayName)
    expect(bobLike?.createdAt).toBeDefined()
    expect(bobLike?.indexedAt).toBeDefined()
    const carolLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[carol].username,
    )
    expect(carolLike?.did).toEqual(carol)
    expect(carolLike?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolLike?.createdAt).toBeDefined()
    expect(carolLike?.indexedAt).toBeDefined()
    const danLike = view.data.likedBy.find(
      (l) => l.name === sc.accounts[dan].username,
    )
    expect(danLike?.did).toEqual(dan)
    expect(danLike?.displayName).toEqual(sc.profiles[dan]?.displayName)
    expect(danLike?.createdAt).toBeDefined()
    expect(danLike?.indexedAt).toBeDefined()
  })

  it('fetches reposted by view', async () => {
    const view = await client.todo.social.getRepostedBy({
      uri: sc.posts[dan][1].uriRaw,
    })
    expect(view.data.uri).toEqual(sc.posts[dan][1].uriRaw)
    expect(view.data.repostedBy.length).toBe(1)
    const repost = view.data.repostedBy[0]
    expect(repost.did).toEqual(carol)
    expect(repost.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(repost.createdAt).toBeDefined()
    expect(repost.indexedAt).toBeDefined()
  })

  it('fetches followers', async () => {
    const view = await client.todo.social.getUserFollowers({
      user: 'alice.test',
    })
    expect(view.data.subject.did).toEqual(alice)
    expect(view.data.subject.name).toEqual(sc.accounts[alice].username)
    expect(view.data.subject.displayName).toEqual(
      sc.profiles[alice].displayName,
    )
    const bobFollow = view.data.followers.find(
      (f) => f.name === sc.accounts[bob].username,
    )
    expect(bobFollow?.did).toEqual(bob)
    expect(bobFollow?.name).toEqual(sc.accounts[bob].username)
    expect(bobFollow?.displayName).toEqual(sc.profiles[bob].displayName)
    expect(bobFollow?.createdAt).toBeDefined()
    expect(bobFollow?.indexedAt).toBeDefined()
    const carolFollow = view.data.followers.find(
      (f) => f.name === sc.accounts[carol].username,
    )
    expect(carolFollow?.did).toEqual(carol)
    expect(carolFollow?.name).toEqual(sc.accounts[carol].username)
    expect(carolFollow?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches follows', async () => {
    const view = await client.todo.social.getUserFollows({
      user: 'bob.test',
    })
    expect(view.data.subject.did).toEqual(bob)
    expect(view.data.subject.name).toEqual(sc.accounts[bob].username)
    expect(view.data.subject.displayName).toEqual(sc.profiles[bob].displayName)
    const aliceFollow = view.data.follows.find(
      (f) => f.name === sc.accounts[alice].username,
    )
    expect(aliceFollow?.did).toEqual(alice)
    expect(aliceFollow?.name).toEqual(sc.accounts[alice].username)
    expect(aliceFollow?.displayName).toEqual(sc.profiles[alice].displayName)
    expect(aliceFollow?.createdAt).toBeDefined()
    expect(aliceFollow?.indexedAt).toBeDefined()
    const carolFollow = view.data.follows.find(
      (f) => f.name === sc.accounts[carol].username,
    )
    expect(carolFollow?.did).toEqual(carol)
    expect(carolFollow?.name).toEqual(sc.accounts[carol].username)
    expect(carolFollow?.displayName).toEqual(sc.profiles[carol]?.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches profile', async () => {
    const aliceProf = await client.todo.social.getProfile(
      {
        user: 'alice.test',
      },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(aliceProf.data.did).toEqual(alice)
    expect(aliceProf.data.name).toEqual(sc.accounts[alice].username)
    expect(aliceProf.data.displayName).toEqual(sc.profiles[alice].displayName)
    expect(aliceProf.data.description).toEqual(sc.profiles[alice].description)
    expect(aliceProf.data.followersCount).toEqual(2)
    expect(aliceProf.data.followsCount).toEqual(3)
    expect(aliceProf.data.postsCount).toEqual(4)
    // TODO
    // expect(aliceProf.data.badges.length).toEqual(1)
    // expect(aliceProf.data.badges[0].uri).toEqual(badges[0].toString())
    // expect(aliceProf.data.badges[0].assertion?.type).toEqual('tag')
    // expect(aliceProf.data.badges[0].issuer?.did).toEqual(bob)
    // expect(aliceProf.data.badges[0].issuer?.name).toEqual(users.bob.name)
    // expect(aliceProf.data.badges[0].issuer?.displayName).toEqual(
    //   users.bob.displayName,
    // )
    expect(aliceProf.data.myState?.follow).toEqual(
      sc.follows[bob][alice].toString(),
    )

    const danProf = await client.todo.social.getProfile(
      {
        user: 'dan.test',
      },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    expect(danProf.data.did).toEqual(dan)
    expect(danProf.data.name).toEqual(sc.accounts[dan].username)
    expect(danProf.data.displayName).toEqual(sc.profiles[dan]?.displayName)
    expect(danProf.data.description).toEqual(sc.profiles[dan]?.description)
    expect(danProf.data.followersCount).toEqual(1)
    expect(danProf.data.followsCount).toEqual(1)
    expect(danProf.data.postsCount).toEqual(2)
    expect(danProf.data.badges).toEqual([])
    expect(danProf.data.myState?.follow).toEqual(
      sc.follows[bob][dan]?.toString(),
    )
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

  it('fetches author feed', async () => {
    const aliceFeed = await client.todo.social.getAuthorFeed(
      { author: 'alice.test' },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.replies[alice][0].text,
      sc.posts[alice][2].text,
      sc.posts[alice][1].text,
      sc.posts[alice][0].text,
    ])

    const aliceFeed2 = await client.todo.social.getAuthorFeed(
      { author: 'alice.test', before: aliceFeed.data.feed[0].cursor, limit: 1 },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed2.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[alice][2].text,
    ])

    const carolFeed = await client.todo.social.getAuthorFeed(
      { author: 'carol.test' },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(carolFeed.data.feed.map((item) => item.record.text)).toEqual([
      sc.posts[dan][1].text,
      sc.replies[carol][0].text,
      sc.posts[carol][0].text,
    ])
  })

  it('fetches postThread', async () => {
    const thread = await client.todo.social.getPostThread(
      { uri: sc.posts[alice][1].uriRaw },
      undefined,
      {
        headers: sc.getHeaders(bob),
      },
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.record.text).toEqual(sc.posts[alice][1].text)
    expect(thread.data.thread.replyCount).toEqual(2)
    expect(thread.data.thread.likeCount).toEqual(3)
    expect(thread.data.thread.replies?.length).toEqual(2)
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[0].record.text).toEqual(
      sc.replies[carol][0].text,
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].record.text).toEqual(
      sc.replies[bob][0].text,
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].parent?.record.text).toEqual(
      sc.posts[alice][1].text,
    )
    /** @ts-ignore TODO */
    // TODO: this is failing -- not clear to me why
    expect(thread.data.thread.replies?.[1].replies?.[0].record.text).toEqual(
      sc.replies[alice][0].text,
    )
  })

  it('fetches notifications', async () => {
    const notifCount = await client.todo.social.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )
    expect(notifCount.data.count).toBe(11)

    const notifRes = await client.todo.social.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(11)

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.

    expect(notifs[10].reason).toBe('follow')
    expect(notifs[10].author.did).toBe(carol)

    expect(notifs[9].reason).toBe('follow')
    expect(notifs[9].author.did).toBe(bob)

    expect(notifs[8].reason).toBe('mention')
    expect(notifs[8].author.did).toBe(dan)

    expect(notifs[7].reason).toBe('like')
    expect(notifs[7].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[7].author.did).toBe(bob)

    expect(notifs[6].reason).toBe('like')
    expect(notifs[6].reasonSubject).toBe(sc.posts[alice][2].uriRaw)
    expect(notifs[6].author.did).toBe(bob)

    expect(notifs[5].reason).toBe('like')
    expect(notifs[5].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[5].author.did).toBe(carol)

    expect(notifs[4].reason).toBe('like')
    expect(notifs[4].reasonSubject).toBe(sc.posts[alice][2].uriRaw)
    expect(notifs[4].author.did).toBe(carol)

    expect(notifs[3].reason).toBe('like')
    expect(notifs[3].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[3].author.did).toBe(dan)

    expect(notifs[2].reason).toBe('reply')
    expect(notifs[2].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[2].author.did).toBe(bob)

    expect(notifs[1].reason).toBe('reply')
    expect(notifs[1].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[1].author.did).toBe(carol)

    expect(notifs[0].reason).toBe('repost')
    expect(notifs[0].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[0].author.did).toBe(dan)

    const noneRead = notifs.every((notif) => !notif.isRead)
    expect(noneRead).toBeTruthy()
  })

  it('updates notifications last seen', async () => {
    await client.todo.social.postNotificationsSeen(
      {},
      { seenAt: new Date().toISOString() },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )

    const notifCount = await client.todo.social.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )
    expect(notifCount.data.count).toBe(0)

    const notifs = await client.todo.social.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const allRead = notifs.data.notifications.every((notif) => notif.isRead)
    expect(allRead).toBeTruthy()
  })
})
