import AtpAgent, { AtUri } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { NotificationServer } from '../src/notifications'
import { Database } from '../src'
import { sql } from 'kysely'

describe('notification views', () => {
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

    it('gets notification display attributes: title and body', async () => {})

    it('prepares notification to be sent', async () => {})
  })

  async function getNotifications(db: Database, uri: AtUri) {
    return await db.db
      .selectFrom('notification')
      .selectAll()
      .select(sql`0`.as('id')) // Ignore notification ids in comparisons
      .where('recordUri', '=', uri.toString())
      .orderBy('sortAt')
      .execute()
  }
})
