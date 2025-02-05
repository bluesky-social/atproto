import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { Users, feedHiddenRepliesSeed } from '../seed/feed-hidden-replies'

describe('feed hidden replies', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let users: Users

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_feed_hidden_replies',
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
          headers: await network.serviceHeaders(
            users.poster.did,
            ids.AppBskyNotificationListNotifications,
          ),
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

      expect(posterNotificationB).toBeUndefined()
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

    it(`[A] -> [B] -> [C] -> [D] : C is hidden, D results in no notification for A or B, notification for C, C exists in B's notifications`, async () => {
      const A = await sc.post(users.poster.did, `A`)
      await network.processAll()
      const B = await sc.reply(users.replier.did, A.ref, A.ref, `B`)
      await network.processAll()
      const C = await sc.reply(users.viewer.did, A.ref, B.ref, `C`)
      await network.processAll()

      const {
        data: { notifications: posterNotificationsBefore },
      } = await agent.api.app.bsky.notification.listNotifications(
        {},
        {
          headers: await network.serviceHeaders(
            users.poster.did,
            ids.AppBskyNotificationListNotifications,
          ),
        },
      )

      const posterNotificationCBefore = posterNotificationsBefore.find(
        (item) => {
          return item.uri === C.ref.uriStr
        },
      )

      expect(posterNotificationCBefore).toBeDefined()

      await pdsAgent.api.app.bsky.feed.threadgate.create(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        {
          post: A.ref.uriStr,
          createdAt: new Date().toISOString(),
          hiddenReplies: [C.ref.uriStr],
        },
        sc.getHeaders(A.ref.uri.host),
      )
      await network.processAll()
      const D = await sc.reply(users.viewer.did, A.ref, C.ref, `D`)
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
      const posterNotificationD = posterNotifications.find((item) => {
        return item.uri === D.ref.uriStr
      })

      expect(posterNotificationB).toBeDefined()
      expect(posterNotificationC).toBeUndefined() // hidden bc OP
      expect(posterNotificationD).toBeUndefined() // hidden bc no propogation

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
      const replierNotificationD = replierNotifications.find((item) => {
        return item.uri === D.ref.uriStr
      })

      expect(replierNotificationC).toBeDefined() // not hidden bc not OP
      expect(replierNotificationD).toBeUndefined() // hidden bc no propogation

      await pdsAgent.api.app.bsky.feed.threadgate.delete(
        {
          repo: A.ref.uri.host,
          rkey: A.ref.uri.rkey,
        },
        sc.getHeaders(A.ref.uri.host),
      )
      await network.processAll()
    })
  })
})
