import AtpAgent, { AtUri } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { NotificationServer } from '../src/notifications'
import { Database } from '../src'

describe('notification server', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let notifServer: NotificationServer

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
      const attrs = await notifServer.getNotificationDisplayAttributes([
        notif,
        flippedNotif,
      ])
      expect(attrs.length).toBe(0)
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
      const attrs = await notifServer.getNotificationDisplayAttributes([notif])
      expect(attrs.length).toBe(0)
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
      const attrs = await notifServer.getNotificationDisplayAttributes([notif])
      expect(attrs.length).toBe(0)
      await pdsAgent.api.app.bsky.graph.unmuteActorList(
        { list: listRef.uri },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
    })

    it('prepares notification to be sent', async () => {
      const db = network.bsky.ctx.db.getPrimary()
      const notif = await getLikeNotification(db, alice)
      if (!notif) throw new Error('no notification found')
      const notifAsArray = [
        notif,
        notif /* second one will get dropped by rate limit */,
      ]
      const prepared = await notifServer.prepareNotifsToSend(notifAsArray)
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
