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
      dbPostgresSchema: 'bsky_notification_server',
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
    it('registers push notification token and device.', async () => {
      const res = await agent.api.app.bsky.notification.registerPush(
        {
          serviceDid: network.bsky.ctx.cfg.serverDid,
          platform: 'ios',
          token: '123',
          appId: 'xyz.blueskyweb.app',
        },
        {
          encoding: 'application/json',
          headers: await network.serviceHeaders(alice),
        },
      )
      expect(res.success).toEqual(true)
    })

    it('allows reregistering push notification token.', async () => {
      const res1 = await agent.api.app.bsky.notification.registerPush(
        {
          serviceDid: network.bsky.ctx.cfg.serverDid,
          platform: 'web',
          token: '234',
          appId: 'xyz.blueskyweb.app',
        },
        {
          encoding: 'application/json',
          headers: await network.serviceHeaders(alice),
        },
      )
      const res2 = await agent.api.app.bsky.notification.registerPush(
        {
          serviceDid: network.bsky.ctx.cfg.serverDid,
          platform: 'web',
          token: '234',
          appId: 'xyz.blueskyweb.app',
        },
        {
          encoding: 'application/json',
          headers: await network.serviceHeaders(alice),
        },
      )
      expect(res1.success).toEqual(true)
      expect(res2.success).toEqual(true)
    })

    it('does not allows registering push notification at mismatching service.', async () => {
      const tryRegister = agent.api.app.bsky.notification.registerPush(
        {
          serviceDid: 'did:web:notifservice.com',
          platform: 'ios',
          token: '123',
          appId: 'xyz.blueskyweb.app',
        },
        {
          encoding: 'application/json',
          headers: await network.serviceHeaders(alice),
        },
      )
      await expect(tryRegister).rejects.toThrow('Invalid serviceDid.')
    })
  })

  describe('NotificationServer', () => {
    it('gets user tokens from db', async () => {
      const tokens = await notifServer.getTokensByDid([alice])
      expect(tokens[alice][0].token).toEqual('123')
    })

    it('gets notification display attributes: title and body', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const attrs = await notifServer.getNotificationDisplayAttributes([notif])
      if (!attrs.length)
        throw new Error('no notification display attributes found')
      expect(attrs[0].title).toEqual('bobby liked your post')
    })

    it('prepares notification to be sent', async () => {
      const db = network.bsky.ctx.db.getPrimary()
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
