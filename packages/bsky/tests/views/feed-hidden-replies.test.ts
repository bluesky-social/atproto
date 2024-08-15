import { TestNetwork, SeedClient } from '@atproto/dev-env'
import AtpAgent, { AppBskyFeedDefs } from '@atproto/api'

import { feedHiddenRepliesSeed, Users } from '../seed/feed-hidden-replies'

describe('postgates', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let users: Users

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_hidden_replies',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()

    const result = await feedHiddenRepliesSeed(sc)
    users = result.users

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe(`timeline`, () => {
    it(`[A] -> [B] : B is hidden`, async () => {
      const A = await sc.post(users.poster.did, `A`)
      const B = await sc.reply(users.replier.did, A.ref, A.ref, `B`)

      await pdsAgent.api.app.bsky.feed.threadgate.create(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        {
          post: A.ref.uriStr,
          createdAt: new Date().toISOString(),
          hiddenReplies: [B.ref.uriStr],
        },
        sc.getHeaders(users.poster.did),
      )

      await network.processAll()

      const {
        data: { feed: timeline },
      } = await agent.api.app.bsky.feed.getTimeline(
        { algorithm: 'reverse-chronological' },
        {
          headers: await network.serviceHeaders(users.viewer.did),
        },
      )

      expect(timeline.length).toBe(1)
    })

    it(`[A] -> [B] -> [C] : B is hidden, C has tombstone on parent`, async () => {
      const A = await sc.post(users.poster.did, `A`)
      const B = await sc.reply(users.replier.did, A.ref, A.ref, `B`)
      const C = await sc.reply(users.replier.did, A.ref, B.ref, `C`)

      await pdsAgent.api.app.bsky.feed.threadgate.create(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        {
          post: A.ref.uriStr,
          createdAt: new Date().toISOString(),
          hiddenReplies: [B.ref.uriStr],
        },
        sc.getHeaders(users.poster.did),
      )

      await network.processAll()

      const {
        data: { feed: timeline },
      } = await agent.api.app.bsky.feed.getTimeline(
        { algorithm: 'reverse-chronological' },
        {
          headers: await network.serviceHeaders(users.viewer.did),
        },
      )

      const viewA = timeline.find((post) => post.post.uri === A.ref.uriStr)
      const viewB = timeline.find((post) => post.post.uri === B.ref.uriStr)
      const viewC = timeline.find((post) => post.post.uri === C.ref.uriStr)

      expect(viewA).toBeDefined()
      expect(viewB).toBeUndefined()
      expect(AppBskyFeedDefs.isNotFoundPost(viewC?.reply?.parent)).toBe(true)
    })

    it(`[A] -> [B] : B is hidden but was reposted`, async () => {
      const A = await sc.post(users.poster.did, `A`)
      const B = await sc.reply(users.replier.did, A.ref, A.ref, `B`)
      await sc.repost(users.reposter.did, B.ref)

      await pdsAgent.api.app.bsky.feed.threadgate.create(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        {
          post: A.ref.uriStr,
          createdAt: new Date().toISOString(),
          hiddenReplies: [B.ref.uriStr],
        },
        sc.getHeaders(users.poster.did),
      )

      await network.processAll()

      const {
        data: { feed: timeline },
      } = await agent.api.app.bsky.feed.getTimeline(
        { algorithm: 'reverse-chronological' },
        {
          headers: await network.serviceHeaders(users.viewer.did),
        },
      )

      const viewB = timeline.find((post) => post.post.uri === B.ref.uriStr)

      expect(viewB).toBeDefined()
    })
  })

  describe(`notifications`, () => {
    it(`[A] -> [B] : B is hidden`, async () => {
      const A = await sc.post(users.poster.did, `A`)

      await network.processAll()

      const B = await sc.reply(users.replier.did, A.ref, A.ref, `B`)
      const C = await sc.reply(users.replier.did, A.ref, A.ref, `C`)

      await pdsAgent.api.app.bsky.feed.threadgate.create(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        {
          post: A.ref.uriStr,
          createdAt: new Date().toISOString(),
          hiddenReplies: [B.ref.uriStr],
        },
        sc.getHeaders(A.ref.uri.host),
      )

      await network.processAll()

      const {
        data: { notifications },
      } = await agent.api.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(users.poster.did),
        },
      )

      const notificationB = notifications.find((item) => {
        return item.uri === B.ref.uriStr
      })
      const notificationC = notifications.find((item) => {
        return item.uri === C.ref.uriStr
      })

      expect(notificationB).toBeUndefined()
      expect(notificationC).toBeDefined()
    })
  })
})
