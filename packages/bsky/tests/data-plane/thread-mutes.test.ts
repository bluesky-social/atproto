import { RecordRef, SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { app } from '@atproto/pds'
import { DidString } from '@atproto/syntax'

describe('thread mutes', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient

  let alice: DidString
  let bob: DidString

  let rootPost: RecordRef
  let replyPost: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_thread_mutes',
    })
    sc = network.getSeedClient()
    client = network.bsky.getClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    rootPost = (await sc.post(alice, 'root post')).ref
    replyPost = (await sc.reply(alice, rootPost, rootPost, 'first reply')).ref
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('mutes threads', async () => {
    await client.call(
      app.bsky.graph.muteThread,
      { root: rootPost.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.graph.muteThread.$lxm,
        ),
      },
    )
  })

  it('notes that threads are muted in viewer state', async () => {
    const res = await client.call(
      app.bsky.feed.getPosts,
      {
        uris: [rootPost.uriStr, replyPost.uriStr],
      },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.feed.getPosts.$lxm,
        ),
      },
    )
    expect(res.posts[0].viewer?.threadMuted).toBe(true)
    expect(res.posts[1].viewer?.threadMuted).toBe(true)
  })

  it('prevents notifs from replies', async () => {
    await sc.reply(bob, rootPost, rootPost, 'reply')
    await sc.reply(bob, rootPost, replyPost, 'reply')
    await network.processAll()

    const notifsRes = await client.call(
      app.bsky.notification.listNotifications,
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.notification.listNotifications.$lxm,
        ),
      },
    )
    expect(notifsRes.notifications.length).toBe(0)
  })

  it('prevents notifs from quote posts', async () => {
    await sc.post(bob, 'quote', undefined, undefined, rootPost)
    await sc.post(bob, 'quote', undefined, undefined, replyPost)
    await network.processAll()

    const notifsRes = await client.call(
      app.bsky.notification.listNotifications,
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.notification.listNotifications.$lxm,
        ),
      },
    )
    expect(notifsRes.notifications.length).toBe(0)
  })

  it('prevents notifs from likes', async () => {
    await sc.like(bob, rootPost)
    await sc.like(bob, replyPost)
    await network.processAll()

    const notifsRes = await client.call(
      app.bsky.notification.listNotifications,
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.notification.listNotifications.$lxm,
        ),
      },
    )
    expect(notifsRes.notifications.length).toBe(0)
  })

  it('prevents notifs from reposts', async () => {
    await sc.repost(bob, rootPost)
    await sc.repost(bob, replyPost)
    await network.processAll()

    const notifsRes = await client.call(
      app.bsky.notification.listNotifications,
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.notification.listNotifications.$lxm,
        ),
      },
    )
    expect(notifsRes.notifications.length).toBe(0)
  })

  it('unmutes threads', async () => {
    await client.call(
      app.bsky.graph.unmuteThread,
      { root: rootPost.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.graph.unmuteThread.$lxm,
        ),
      },
    )
  })

  it('no longer notes that threads are muted in viewer state after unmuting', async () => {
    const res = await client.call(
      app.bsky.feed.getPosts,
      {
        uris: [rootPost.uriStr, replyPost.uriStr],
      },
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.feed.getPosts.$lxm,
        ),
      },
    )
    expect(res.posts[0].viewer?.threadMuted).toBe(false)
    expect(res.posts[1].viewer?.threadMuted).toBe(false)
  })

  it('sends notifications after unmuting', async () => {
    await sc.reply(bob, rootPost, rootPost, 'new reply')
    await sc.reply(bob, rootPost, replyPost, 'new reply')
    await sc.like(bob, rootPost)
    await sc.repost(bob, replyPost)
    await network.processAll()

    const notifsRes = await client.call(
      app.bsky.notification.listNotifications,
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          app.bsky.notification.listNotifications.$lxm,
        ),
      },
    )
    expect(notifsRes.notifications.length).toBe(4)
  })
})
