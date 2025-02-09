import { AtpAgent } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('thread mutes', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string
  let bob: string

  let rootPost: RecordRef
  let replyPost: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_thread_mutes',
    })
    sc = network.getSeedClient()
    agent = network.bsky.getClient()
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
    await agent.api.app.bsky.graph.muteThread(
      { root: rootPost.uriStr },
      {
        encoding: 'application/json',
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphMuteThread,
        ),
      },
    )
  })

  it('notes that threads are muted in viewer state', async () => {
    const res = await agent.api.app.bsky.feed.getPosts(
      {
        uris: [rootPost.uriStr, replyPost.uriStr],
      },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetPosts),
      },
    )
    expect(res.data.posts[0].viewer?.threadMuted).toBe(true)
    expect(res.data.posts[1].viewer?.threadMuted).toBe(true)
  })

  it('prevents notifs from replies', async () => {
    await sc.reply(bob, rootPost, rootPost, 'reply')
    await sc.reply(bob, rootPost, replyPost, 'reply')
    await network.processAll()

    const notifsRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifsRes.data.notifications.length).toBe(0)
  })

  it('prevents notifs from quote posts', async () => {
    await sc.post(bob, 'quote', undefined, undefined, rootPost)
    await sc.post(bob, 'quote', undefined, undefined, replyPost)
    await network.processAll()

    const notifsRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifsRes.data.notifications.length).toBe(0)
  })

  it('prevents notifs from likes', async () => {
    await sc.like(bob, rootPost)
    await sc.like(bob, replyPost)
    await network.processAll()

    const notifsRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifsRes.data.notifications.length).toBe(0)
  })

  it('prevents notifs from reposts', async () => {
    await sc.repost(bob, rootPost)
    await sc.repost(bob, replyPost)
    await network.processAll()

    const notifsRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifsRes.data.notifications.length).toBe(0)
  })

  it('unmutes threads', async () => {
    await agent.api.app.bsky.graph.unmuteThread(
      { root: rootPost.uriStr },
      {
        encoding: 'application/json',
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphUnmuteThread,
        ),
      },
    )
  })

  it('no longer notes that threads are muted in viewer state after unmuting', async () => {
    const res = await agent.api.app.bsky.feed.getPosts(
      {
        uris: [rootPost.uriStr, replyPost.uriStr],
      },
      {
        headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetPosts),
      },
    )
    expect(res.data.posts[0].viewer?.threadMuted).toBe(false)
    expect(res.data.posts[1].viewer?.threadMuted).toBe(false)
  })

  it('sends notifications after unmuting', async () => {
    await sc.reply(bob, rootPost, rootPost, 'new reply')
    await sc.reply(bob, rootPost, replyPost, 'new reply')
    await sc.like(bob, rootPost)
    await sc.repost(bob, replyPost)
    await network.processAll()

    const notifsRes = await agent.api.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    expect(notifsRes.data.notifications.length).toBe(4)
  })
})
