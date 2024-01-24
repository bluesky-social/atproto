import AtpAgent, { AtUri } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import {
  CourierNotificationServer,
  GorushNotificationServer,
} from '../src/notifications'
import { Database } from '../src'
import { createCourierClient } from '../src/courier'

describe('notification server', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let notifServer: GorushNotificationServer

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_notification_server',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.processAll()
    alice = sc.dids.alice
    notifServer = new GorushNotificationServer(
      network.bsky.ctx.db.getPrimary(),
      'http://mock',
    )
  })

  afterAll(async () => {
    await network.close()
  })

  describe('registerPush', () => {
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
    it('gets notification display attributes: title and body', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const views = await notifServer.getNotificationViews([notif])
      if (!views.length)
        throw new Error('no notification display attributes found')
      expect(views[0].title).toEqual('bobby liked your post')
    })

    it('filters notifications that violate blocks', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const blockRef = await pdsAgent.api.app.bsky.graph.block.create(
        { repo: alice },
        { subject: notif.author, createdAt: new Date().toISOString() },
        sc.getHeaders(alice),
      )
      await network.processAll()
      // verify inverse of block
      const flippedNotif = {
        ...notif,
        did: notif.author,
        author: notif.did,
      }
      const views = await notifServer.getNotificationViews([
        notif,
        flippedNotif,
      ])
      expect(views.length).toBe(0)
      const uri = new AtUri(blockRef.uri)
      await pdsAgent.api.app.bsky.graph.block.delete(
        { repo: alice, rkey: uri.rkey },
        sc.getHeaders(alice),
      )
      await network.processAll()
    })

    it('filters notifications that violate mutes', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      await pdsAgent.api.app.bsky.graph.muteActor(
        { actor: notif.author },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
      const views = await notifServer.getNotificationViews([notif])
      expect(views.length).toBe(0)
      await pdsAgent.api.app.bsky.graph.unmuteActor(
        { actor: notif.author },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
    })

    it('filters notifications that violate mutelists', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const listRef = await pdsAgent.api.app.bsky.graph.list.create(
        { repo: alice },
        {
          name: 'mute',
          purpose: 'app.bsky.graph.defs#modlist',
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(alice),
      )
      await pdsAgent.api.app.bsky.graph.listitem.create(
        { repo: alice },
        {
          subject: notif.author,
          list: listRef.uri,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(alice),
      )
      await network.processAll()
      await pdsAgent.api.app.bsky.graph.muteActorList(
        { list: listRef.uri },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
      const views = await notifServer.getNotificationViews([notif])
      expect(views.length).toBe(0)
      await pdsAgent.api.app.bsky.graph.unmuteActorList(
        { list: listRef.uri },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
    })
  })

  describe('GorushNotificationServer', () => {
    it('gets user tokens from db', async () => {
      const tokens = await notifServer.getTokensByDid([alice])
      expect(tokens[alice][0].token).toEqual('123')
    })

    it('prepares notification to be sent', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const notifAsArray = [
        notif,
        notif /* second one will get dropped by rate limit */,
      ]
      const prepared = await notifServer.prepareNotifications(notifAsArray)
      expect(prepared).toEqual([
        {
          collapse_id: 'like',
          collapse_key: 'like',
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

  describe('CourierNotificationServer', () => {
    it('prepares notification to be sent', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const courierNotifServer = new CourierNotificationServer(
        db,
        createCourierClient({ baseUrl: 'http://mock', httpVersion: '2' }),
      )
      const prepared = await courierNotifServer.prepareNotifications([notif])
      expect(prepared[0]?.id).toBeTruthy()
      expect(prepared.map((p) => p.toJson())).toEqual([
        {
          id: prepared[0].id, // already ensured it exists
          recipientDid: notif.did,
          title: 'bobby liked your post',
          message: 'again',
          collapseKey: 'like',
          timestamp: notif.sortAt,
          // this is missing, appears to be a quirk of toJson()
          // alwaysDeliver: false,
          additional: {
            reason: notif.reason,
            uri: notif.recordUri,
            subject: notif.reasonSubject,
          },
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
