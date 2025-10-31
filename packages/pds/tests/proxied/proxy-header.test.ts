import assert from 'node:assert'
import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import express from 'express'
import { Keypair } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { verifyJwt } from '@atproto/xrpc-server'
import { parseProxyHeader } from '../../src/pipethrough'

describe('proxy header', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  let alice: string

  let proxyServer: ProxyServer

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'proxy_header',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)

    proxyServer = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'atproto_test',
    )

    alice = sc.dids.alice
    await network.processAll()
  })

  afterAll(async () => {
    await proxyServer.close()
    await network.close()
  })

  it('parses proxy header', async () => {
    expect(parseProxyHeader(network.pds.ctx, `#atproto_test`)).rejects.toThrow(
      'no did specified in proxy header',
    )

    expect(
      parseProxyHeader(network.pds.ctx, `${proxyServer.did}#atproto_test#foo`),
    ).rejects.toThrow('invalid proxy header format')

    expect(
      parseProxyHeader(network.pds.ctx, `${proxyServer.did}#atproto_test `),
    ).rejects.toThrow('proxy header cannot contain spaces')

    expect(
      parseProxyHeader(network.pds.ctx, ` ${proxyServer.did}#atproto_test`),
    ).rejects.toThrow('proxy header cannot contain spaces')

    expect(parseProxyHeader(network.pds.ctx, `foo#bar`)).rejects.toThrow(
      'Poorly formatted DID: foo',
    )

    expect(
      parseProxyHeader(network.pds.ctx, `${proxyServer.did}#atproto_test`),
    ).resolves.toEqual({
      did: proxyServer.did,
      url: proxyServer.url,
    })
  })

  it('proxies requests based on header', async () => {
    const path = `/xrpc/app.bsky.actor.getProfile?actor=${alice}`
    await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${proxyServer.did}#atproto_test`,
      },
    })
    const req = proxyServer.requests.at(-1)
    assert(req)
    expect(req.url).toEqual(path)
    assert(req.auth)
    const verified = await verifyJwt(
      req.auth.replace('Bearer ', ''),
      proxyServer.did,
      'app.bsky.actor.getProfile',
      (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
    )
    expect(verified.aud).toBe(proxyServer.did)
    expect(verified.iss).toBe(alice)
  })

  it('fails on a non-existant did', async () => {
    const path = `/xrpc/app.bsky.actor.getProfile?actor=${alice}`
    const response = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `did:plc:12345678123456781234578#atproto_test`,
      },
    })

    await expect(response.json()).resolves.toMatchObject({
      message: 'could not resolve proxy did',
    })

    expect(proxyServer.requests.length).toBe(1)
  })

  it('fails when a service is not specified', async () => {
    const path = `/xrpc/app.bsky.actor.getProfile?actor=${alice}`
    const response = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': proxyServer.did,
      },
    })

    await expect(response.json()).resolves.toMatchObject({
      message: 'no service id specified in proxy header',
    })

    expect(proxyServer.requests.length).toBe(1)
  })

  it('fails on a non-existant service', async () => {
    const path = `/xrpc/app.bsky.actor.getProfile?actor=${alice}`
    const response = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${proxyServer.did}#atproto_bad`,
      },
    })

    await expect(response.json()).resolves.toMatchObject({
      message: 'could not resolve proxy did service url',
    })

    expect(proxyServer.requests.length).toBe(1)
  })

  it('handles failing manual pipethroughs', async () => {
    // This is a PDS endpoint which uses a manual pipethrough() in its handler
    const path = '/xrpc/app.bsky.actor.getPreferences'
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${proxyServer.did}#atproto_test`,
      },
    })
    await res.arrayBuffer() // drain
    expect(res.status).toBe(501)
  })
})

type ProxyReq = {
  url: string
  auth: string | undefined
}

class ProxyServer {
  constructor(
    public server: http.Server,
    public url: string,
    public did: string,
    public requests: ProxyReq[],
  ) {}

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const requests: ProxyReq[] = []
    const app = express()

    // This is a PDS endpoint which uses a manual pipethrough() in its handler
    app.get('/xrpc/app.bsky.actor.getPreferences', (req, res) => {
      res.sendStatus(501)
    })

    app.get('*', (req, res) => {
      requests.push({
        url: req.url,
        auth: req.header('authorization'),
      })
      res.sendStatus(200)
    })

    const server = app.listen(0)
    await once(server, 'listening')

    const { port } = server.address() as AddressInfo

    const url = `http://localhost:${port}`
    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [serviceId]: {
            type: 'TestAtprotoService',
            endpoint: url,
          },
        },
        prev: null,
      },
      keypair,
    )
    const did = await plc.didForCreateOp(plcOp)
    await plcClient.sendOperation(did, plcOp)
    return new ProxyServer(server, url, did, requests)
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve())
    })
  }
}
