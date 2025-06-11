import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import express from 'express'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { verifyJwt } from '@atproto/xrpc-server'
import { createServer } from '../../src/lexicon'
import usersSeed from '../seeds/users'

describe('notif service proxy', () => {
  let network: TestNetworkNoAppView
  let notifServer: http.Server
  let notifDid: string
  let agent: AtpAgent
  let sc: SeedClient
  const spy: { current: unknown } = { current: null }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'proxy_notifs',
    })
    network.pds.server.app.get
    const plc = network.plc.getClient()
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    // piggybacking existing plc did, turn it into a notif service
    notifServer = await createMockNotifService(spy)
    notifDid = sc.dids.dan
    await plc.updateData(notifDid, network.pds.ctx.plcRotationKey, (x) => {
      const addr = notifServer.address() as AddressInfo
      x.services['bsky_notif'] = {
        type: 'BskyNotificationService',
        endpoint: `http://localhost:${addr.port}`,
      }
      return x
    })
    await network.pds.ctx.idResolver.did.resolve(notifDid, true)
  })

  afterAll(async () => {
    await network.close()
    notifServer.close()
    await once(notifServer, 'close')
  })

  it('proxies to notif service.', async () => {
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
})

async function createMockNotifService(ref: { current: unknown }) {
  const app = express()
  const svc = createServer()
  svc.app.bsky.notification.registerPush(({ input, req }) => {
    ref.current = {
      input: input.body,
      jwt: req.headers.authorization?.replace('Bearer ', ''),
    }
  })
  app.use(svc.xrpc.router)
  const server = app.listen()
  await once(server, 'listening')
  return server
}
