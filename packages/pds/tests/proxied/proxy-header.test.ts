import assert from 'node:assert'
import {
  type SeedClient,
  TestNetworkNoAppView,
  usersSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { verifyJwt } from '@atproto/xrpc-server'
import { parseProxyHeader } from '../../src/pipethrough.js'
import { ProxyServer } from './proxy-server.js'

describe('proxy header', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  let alice: DidString

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
  }, 20_000) // @NOTE seeding can take a while

  afterAll(async () => {
    await proxyServer?.close()
    await network?.close()
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

    expect(parseProxyHeader(network.pds.ctx, `did:foo#bar`)).rejects.toThrow(
      'Poorly formatted DID: did:foo',
    )

    expect(
      parseProxyHeader(network.pds.ctx, `did:foo:bar#baz`),
    ).rejects.toThrow('Unsupported DID method: did:foo:bar')

    expect(
      parseProxyHeader(network.pds.ctx, `did:toString:foo#bar`),
    ).rejects.toThrow('Unsupported DID method: did:toString:foo')

    expect(parseProxyHeader(network.pds.ctx, `foo#bar`)).rejects.toThrow(
      'Poorly formatted DID: foo',
    )

    expect(
      parseProxyHeader(network.pds.ctx, `${proxyServer.did}#atproto_test`),
    ).resolves.toEqual({
      did: proxyServer.did,
      url: proxyServer.url,
      serviceId: 'atproto_test',
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
