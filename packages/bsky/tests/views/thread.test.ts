import AtpAgent, { AppBskyFeedGetPostThread } from '@atproto/api'
import { CloseFn, runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { Database } from '../../src'
import { forSnapshot, processAll, stripViewerFromThread } from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import threadSeed, { walk, item, Item } from '../seeds/thread'

describe('pds thread views', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let db: Database
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'views_thread',
    })
    db = testEnv.bsky.ctx.db
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeAll(async () => {
    // Add a repost of a reply so that we can confirm myState in the thread
    await sc.repost(bob, sc.replies[alice][0].ref)
    await processAll(testEnv)
  })

  afterAll(async () => {
    await close()
  })

  // @TODO(bsky) blocks post by actor takedown via labels.
  // @TODO(bsky) blocks post by record takedown via labels.
  // @TODO(bsky) blocks replies by actor takedown via labels.
  // @TODO(bsky) blocks ancestors by record takedown via labels.
  // @TODO(bsky) blocks ancestors by actor takedown via labels.

  it('fetches deep post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches shallow post thread', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fetches ancestors', async () => {
    const thread = await agent.api.app.bsky.feed.getPostThread(
      { depth: 1, uri: sc.replies[alice][0].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(forSnapshot(thread.data.thread)).toMatchSnapshot()
  })

  it('fails for an unknown post', async () => {
    const promise = agent.api.app.bsky.feed.getPostThread(
      { uri: 'at://did:example:fake/does.not.exist/self' },
      { headers: sc.getHeaders(bob, true) },
    )

    await expect(promise).rejects.toThrow(
      AppBskyFeedGetPostThread.NotFoundError,
    )
  })

  it('fetches post thread unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getPostThread({
      uri: sc.posts[alice][1].ref.uriStr,
    })
    expect(unauthed.thread).toEqual(stripViewerFromThread(authed.thread))
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
    await processAll(testEnv)

    const thread1 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )
    expect(forSnapshot(thread1.data.thread)).toMatchSnapshot()

    await sc.deletePost(bob, sc.replies[bob][indexes.bobReply].ref.uri)
    await processAll(testEnv)

    const thread2 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.posts[alice][indexes.aliceRoot].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )
    expect(forSnapshot(thread2.data.thread)).toMatchSnapshot()

    const thread3 = await agent.api.app.bsky.feed.getPostThread(
      { uri: sc.replies[alice][indexes.aliceReplyReply].ref.uriStr },
      { headers: sc.getHeaders(bob, true) },
    )
    expect(forSnapshot(thread3.data.thread)).toMatchSnapshot()
  })

  it('builds post hierarchy index.', async () => {
    const threads: Item[] = [
      item(1, [item(2, [item(3), item(4)])]),
      item(5, [item(6), item(7, [item(9, [item(11)]), item(10)]), item(8)]),
      item(12),
    ]

    await threadSeed(sc, sc.dids.alice, threads)
    await processAll(testEnv)

    let closureSize = 0
    const itemByUri: Record<string, Item> = {}

    const postsAndReplies = ([] as { text: string; ref: RecordRef }[])
      .concat(Object.values(sc.posts[sc.dids.alice]))
      .concat(Object.values(sc.replies[sc.dids.alice]))
      .filter((p) => {
        const id = parseInt(p.text, 10)
        return 0 < id && id <= 12
      })

    await walk(threads, async (item, depth) => {
      const post = postsAndReplies.find((p) => p.text === String(item.id))
      if (!post) throw new Error('Post not found')
      itemByUri[post.ref.uriStr] = item
      closureSize += depth + 1
    })

    const hierarchy = await db.db
      .selectFrom('post_hierarchy')
      .where(
        'uri',
        'in',
        postsAndReplies.map((p) => p.ref.uriStr),
      )
      .orWhere(
        'ancestorUri',
        'in',
        postsAndReplies.map((p) => p.ref.uriStr),
      )
      .selectAll()
      .execute()

    expect(hierarchy.length).toEqual(closureSize)

    for (const relation of hierarchy) {
      const item = itemByUri[relation.uri]
      const ancestor = itemByUri[relation.ancestorUri]
      let depth = -1
      await walk([ancestor], async (candidate, candidateDepth) => {
        if (candidate === item) {
          depth = candidateDepth
        }
      })
      expect(depth).toEqual(relation.depth)
    }
  })
})
