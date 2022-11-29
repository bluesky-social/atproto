import AtpApi, {
  ServiceClient as AtpServiceClient,
  AppBskyFeedGetPostThread,
} from '@atproto/api'
import { runTestServer, forSnapshot, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds thread views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_thread',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeAll(async () => {
    // Add a repost of a reply so that we can confirm myState in the thread
    await sc.repost(bob, sc.replies[alice][0].ref)
  })

  afterAll(async () => {
    await close()
  })

  it('fetches deep post thread', async () => {
    const thread = await client.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await client.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches ancestors', async () => {
    const thread = await client.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = client.app.bsky.feed.getPostThread(
      { uri: 'does.not.exist' },
      { headers: sc.getHeaders(bob) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )
  })

  it('handles deleted posts correctly', async () => {
    const alice = sc.dids.alice
    const bob = sc.dids.bob

    const indexes = {
      aliceRoot: -1,
      bobReply: -1,
      aliceReplyReply: -1,
    }

    await sc.post(alice, 'Deletion thread')
    indexes.aliceRoot = sc.posts[alice].length - 1

    await sc.reply(
      bob,
      sc.posts[alice][indexes.aliceRoot].ref,
      sc.posts[alice][indexes.aliceRoot].ref,
      'Reply',
    )
    indexes.bobReply = sc.replies[bob].length - 1
    await sc.reply(
      alice,
      sc.posts[alice][indexes.aliceRoot].ref,
      sc.replies[bob][indexes.bobReply].ref,
      'Reply reply',
    )
    indexes.aliceReplyReply = sc.replies[alice].length - 1

    const thread1 = await client.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread1.data.thread)).toMatchSnapshot()

    await sc.deletePost(bob, sc.replies[bob][indexes.bobReply].ref.uri)

    const thread2 = await client.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread2.data.thread)).toMatchSnapshot()

    const thread3 = await client.app.bsky.feed.getPostThread(
      { uri: sc.replies[alice][indexes.aliceReplyReply].ref.uriStr },
      { headers: sc.getHeaders(bob) },
    )
    expect(forSnapshot(thread3.data.thread)).toMatchSnapshot()
  })
})
