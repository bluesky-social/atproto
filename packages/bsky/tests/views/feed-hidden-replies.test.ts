import { TestNetwork, SeedClient } from '@atproto/dev-env'
import AtpAgent, { AppBskyFeedDefs } from '@atproto/api'

import { ids } from '../../src/lexicon/lexicons'
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
        {},
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetTimeline,
          ),
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
        {},
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetTimeline,
          ),
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
        {},
        {
          headers: await network.serviceHeaders(
            users.viewer.did,
            ids.AppBskyFeedGetTimeline,
          ),
        },
      )

      const viewB = timeline.find((post) => post.post.uri === B.ref.uriStr)

      expect(viewB).toBeDefined()
    })
  })

  describe(`notifications`, () => {
    it(`[A] -> [B] -> [C] : B is hidden, C results in no notification for A, notification for B`, async () => {
      const A = await sc.post(users.poster.did, `A`)
      await network.processAll()
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
        sc.getHeaders(A.ref.uri.host),
      )

      await network.processAll()

      const C = await sc.reply(users.viewer.did, A.ref, B.ref, `C`)

      await network.processAll()

      const {
        data: { notifications: posterNotifications },
      } = await agent.api.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(
            users.poster.did,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )

      const posterNotificationB = posterNotifications.find((item) => {
        return item.uri === B.ref.uriStr
      })
      const posterNotificationC = posterNotifications.find((item) => {
        return item.uri === C.ref.uriStr
      })

      expect(posterNotificationB).toBeDefined()
      expect(posterNotificationC).toBeUndefined()

      const {
        data: { notifications: replierNotifications },
      } = await agent.api.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(
            users.replier.did,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )

      const replierNotificationC = replierNotifications.find((item) => {
        return item.uri === C.ref.uriStr
      })

      expect(replierNotificationC).toBeDefined()
    })
  })
})
