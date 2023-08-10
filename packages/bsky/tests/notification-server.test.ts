import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { NotificationServer } from '../src/notifications'
import { Database } from '../src'

describe('notification server', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let notifServer: NotificationServer

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_notifications',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.processAll()
    alice = sc.dids.alice
    notifServer = network.bsky.ctx.notifServer
  })

  afterAll(async () => {
    await network.close()
  })

  describe('registerPushNotification', () => {
    it('registers push notification token and device at specified endpoint or appview', async () => {
      const res = await agent.api.app.bsky.unspecced.registerPushNotification(
        {
          platform: 'ios',
          token: '123',
          appId: 'xyz.blueskyweb.app',
          endpoint: 'app.bsky.unspecced.registerPushNotification',
        },
        {
          headers: await network.serviceHeaders(alice),
        },
      )
      expect(res.success).toEqual(true)
    })
  })

  describe('NotificationServer', () => {
    it('gets user tokens from db', async () => {
      const tokens = await notifServer.getUserTokens(alice)
      expect(tokens[0].token).toEqual('123')
    })

    it('gets notification display attributes: title and body', async () => {
      const db = network.bsky.ctx.db
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const attr = await notifServer.getNotificationDisplayAttributes(notif)
      if (!attr) throw new Error('no notification display attributes found')
      expect(attr.title).toEqual('bobby liked your post')
    })

    it('prepares notification to be sent', async () => {
      const db = network.bsky.ctx.db
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const notifAsArray = [notif]
      const prepared = await notifServer.prepareNotifsToSend(notifAsArray)
      expect(prepared).toEqual([
        {
          data: {
            reason: notif.reason,
            recordCid: notif.recordCid,
            recordUri: notif.recordUri,
          },
          message: 'again',
          platform: 1,
          title: 'bobby liked your post',
          tokens: ['123'],
          topic: 'xyz.blueskyweb.app',
        },
      ])
    })
  })

  async function getLikeNotification(db: Database, did: string) {
    return await db.db
      .selectFrom('notification')
      .selectAll()
      .where('did', '=', did)
      .where('reason', '=', 'like')
      .orderBy('sortAt')
      .executeTakeFirst()
  }
})
