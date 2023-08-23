import { once } from 'events'
import http from 'http'
import { AddressInfo } from 'net'
import express from 'express'
import AtpAgent from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { verifyJwt } from '@atproto/xrpc-server'
import { SeedClient } from '../seeds/client'
import usersSeed from '../seeds/users'
import { createServer } from '../../src/lexicon'

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
    sc = new SeedClient(agent)
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
      async () => network.pds.ctx.repoSigningKey.did(),
    )
    expect(auth).toEqual(sc.dids.bob)
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
