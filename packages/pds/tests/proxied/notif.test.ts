import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { createServer, verifyJwt } from '@atproto/xrpc-server'
import { app } from '../../src/lexicons/index.js'
import { startServer } from '../_util.js'
import usersSeed from '../seeds/users.js'

describe('notif service proxy', () => {
  let network: TestNetworkNoAppView
  let notifServer: AsyncDisposable & { port: number }
  let notifDid: string
  let agent: AtpAgent
  let sc: SeedClient
  const spy: { current: unknown } = { current: null }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'proxy_notifs',
    })
    const plc = network.plc.getClient()
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    // piggybacking existing plc did, turn it into a notif service
    notifServer = await createMockNotifService(spy)
    notifDid = sc.dids.dan
    await plc.updateData(notifDid, network.pds.ctx.plcRotationKey, (x) => {
      x.services['bsky_notif'] = {
        type: 'BskyNotificationService',
        endpoint: `http://localhost:${notifServer.port}`,
      }
      return x
    })
    await network.pds.ctx.idResolver.did.resolve(notifDid, true)
  }, 20_000) // @NOTE seeding can take a while

  afterAll(async () => {
    await notifServer?.[Symbol.asyncDispose]()
    await network?.close()
  })

  it('proxies registerPush to notif service.', async () => {
    await agent.api.app.bsky.notification.registerPush(
      {
        serviceDid: notifDid,
        token: 'tok1',
        platform: 'web',
        appId: 'app1',
      },
      {
        headers: sc.getHeaders(sc.dids.bob),
        encoding: 'application/json',
      },
    )
    expect(spy.current?.['input']).toEqual({
      serviceDid: notifDid,
      token: 'tok1',
      platform: 'web',
      appId: 'app1',
    })

    const auth = await verifyJwt(
      spy.current?.['jwt'] as string,
      notifDid,
      'app.bsky.notification.registerPush',
      async (did) => {
        const keypair = await network.pds.ctx.actorStore.keypair(did)
        return keypair.did()
      },
    )
    expect(auth.iss).toEqual(sc.dids.bob)
  })

  it('proxies unregisterPush to notif service.', async () => {
    await agent.api.app.bsky.notification.unregisterPush(
      {
        serviceDid: notifDid,
        token: 'tok1',
        platform: 'web',
        appId: 'app1',
      },
      {
        headers: sc.getHeaders(sc.dids.bob),
        encoding: 'application/json',
      },
    )
    expect(spy.current?.['input']).toEqual({
      serviceDid: notifDid,
      token: 'tok1',
      platform: 'web',
      appId: 'app1',
    })

    const auth = await verifyJwt(
      spy.current?.['jwt'] as string,
      notifDid,
      'app.bsky.notification.unregisterPush',
      async (did) => {
        const keypair = await network.pds.ctx.actorStore.keypair(did)
        return keypair.did()
      },
    )
    expect(auth.iss).toEqual(sc.dids.bob)
  })
})

async function createMockNotifService(ref: { current: unknown }) {
  const svc = createServer()
  svc.add(app.bsky.notification.registerPush, ({ input, req }) => {
    ref.current = {
      input: input.body,
      jwt: req.headers.authorization?.replace('Bearer ', ''),
    }
  })
  svc.add(app.bsky.notification.unregisterPush, ({ input, req }) => {
    ref.current = {
      input: input.body,
      jwt: req.headers.authorization?.replace('Bearer ', ''),
    }
  })
  return startServer(svc.router)
}
