import assert from 'node:assert'
import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import express from 'express'
import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { verifyJwt } from '@atproto/xrpc-server'
import { ids } from '../src/lexicon/lexicons'
import { computeProxyTo, parseProxyHeader } from '../src/pipethrough'

type CapturedReq = {
  url: string
  auth: string | undefined
}

class SokaaAppViewMock {
  constructor(
    public server: http.Server,
    public url: string,
    public did: string,
    public requests: CapturedReq[],
  ) {}

  static async create(did: string): Promise<SokaaAppViewMock> {
    const requests: CapturedReq[] = []
    const app = express()

    app.get('*', (req, res) => {
      requests.push({
        url: req.url,
        auth: req.headers.authorization,
      })
      res.status(200)
      res.setHeader('content-type', 'application/json')
      res.send('{"feed":[]}')
    })

    const server = app.listen(0)
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo
    return new SokaaAppViewMock(
      server,
      `http://127.0.0.1:${port}`,
      did,
      requests,
    )
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

describe('sokaa appview proxy routing', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let alice: string
  let appview: SokaaAppViewMock

  beforeAll(async () => {
    appview = await SokaaAppViewMock.create('did:web:sokaa.appview.test')

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sokaa_proxy',
      pds: {
        sokaaAppViewUrl: appview.url,
        sokaaAppViewDid: appview.did,
      },
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    await network.processAll()
  })

  afterAll(async () => {
    await appview?.close()
    await network?.close()
  })

  it('routes app.sokaa.* to sokaa_appview via computeProxyTo', () => {
    const req = { header: () => undefined } as unknown as express.Request
    const ctx = network.pds.ctx as unknown as Parameters<
      typeof computeProxyTo
    >[0]
    expect(computeProxyTo(ctx, req, ids.AppSokaaFeedGetTimeline)).toBe(
      `${appview.did}#sokaa_appview`,
    )
    expect(computeProxyTo(ctx, req, ids.AppBskyFeedGetTimeline)).toBe(
      `${network.pds.ctx.cfg.bskyAppView?.did}#bsky_appview`,
    )
  })

  it('proxies app.sokaa.feed.getTimeline with service JWT', async () => {
    const path = `/xrpc/app.sokaa.feed.getTimeline?limit=10`
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: sc.getHeaders(alice),
    })
    expect(res.status).toBe(200)

    const req = appview.requests.at(-1)
    assert(req)
    expect(req.url).toBe(path)
    assert(req.auth)

    const verified = await verifyJwt(
      req.auth.replace('Bearer ', ''),
      appview.did,
      ids.AppSokaaFeedGetTimeline,
      (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
    )
    expect(verified.aud).toBe(appview.did)
    expect(verified.iss).toBe(alice)
    expect(verified.lxm).toBe(ids.AppSokaaFeedGetTimeline)
  })

  it('proxies app.sokaa.actor.getProfile with service JWT', async () => {
    const path = `/xrpc/app.sokaa.actor.getProfile?actor=${alice}`
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: sc.getHeaders(alice),
    })
    expect(res.status).toBe(200)

    const req = appview.requests.at(-1)
    assert(req)
    expect(req.url).toBe(path)
    assert(req.auth)

    const verified = await verifyJwt(
      req.auth.replace('Bearer ', ''),
      appview.did,
      ids.AppSokaaActorGetProfile,
      (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
    )
    expect(verified.aud).toBe(appview.did)
    expect(verified.iss).toBe(alice)
    expect(verified.lxm).toBe(ids.AppSokaaActorGetProfile)
  })

  it('proxies via atproto-proxy header using configured sokaa appview url', async () => {
    const path = `/xrpc/app.sokaa.feed.getTimeline?limit=5`
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${appview.did}#sokaa_appview`,
      },
    })
    expect(res.status).toBe(200)
    expect(appview.requests.at(-1)?.url).toBe(path)
  })

  it('parseProxyHeader uses configured sokaa appview url', async () => {
    await expect(
      parseProxyHeader(
        network.pds.ctx as unknown as Parameters<typeof parseProxyHeader>[0],
        `${appview.did}#sokaa_appview`,
      ),
    ).resolves.toEqual({ did: appview.did, url: appview.url })
  })

  it('handles com.atproto.repo.createRecord locally without proxying', async () => {
    const before = appview.requests.length
    const agent = network.pds.getClient()
    await agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: ids.AppSokaaGraphFollow,
        record: {
          $type: ids.AppSokaaGraphFollow,
          subject: sc.dids.bob,
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice) },
    )
    expect(appview.requests.length).toBe(before)
  })
})

describe('sokaa appview proxy routing without config', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sokaa_proxy_unconfigured',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  it('errors when sokaa appview is not configured', async () => {
    const path = `/xrpc/app.sokaa.feed.getTimeline?limit=10`
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: sc.getHeaders(alice),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      message: `No service configured for ${ids.AppSokaaFeedGetTimeline}`,
    })
  })
})
