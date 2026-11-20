import assert from 'node:assert'
import { once } from 'node:events'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import { jest } from '@jest/globals'
import express from 'express'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
import type { Keypair } from '@atproto/crypto'
import {
  type SeedClient,
  TestNetworkNoAppView,
  usersSeed,
} from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { verifyJwt } from '@atproto/xrpc-server'
import { parseProxyHeader } from '../../src/pipethrough.js'

const FEEDGEN_DID = 'did:web:feedgen.test'
const EXTERNAL_HANDLE = 'external.example.com'
const EXTERNAL_DID = 'did:web:external.example.com'

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
      isConfiguredAppView: false,
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

  it('fetches the getFeed record from its repo when the appview is unreachable', async () => {
    const res = await fetch(
      `${network.pds.url}/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        headers: {
          ...sc.getHeaders(alice),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          repo: alice,
          collection: 'app.bsky.feed.generator',
          rkey: 'test',
          record: {
            $type: 'app.bsky.feed.generator',
            did: FEEDGEN_DID,
            displayName: 'Test feed',
            createdAt: new Date().toISOString(),
          },
        }),
      },
    )
    await res.arrayBuffer() // drain
    assert(res.ok)

    // The configured appview is unreachable in this network
    const requestCount = proxyServer.requests.length
    const feed = `at://${alice}/app.bsky.feed.generator/test`
    const path = `/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}`
    const proxiedRes = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${proxyServer.did}#atproto_test`,
      },
    })
    await proxiedRes.arrayBuffer() // drain
    expect(proxiedRes.status).toBe(200)

    // Only the proxied request reaches the service named in the header
    expect(proxyServer.requests.length).toBe(requestCount + 1)
    const proxied = proxyServer.requests.at(-1)
    assert(proxied?.auth)
    expect(proxied.url).toEqual(path)
    const verified = await verifyJwt(
      proxied.auth.replace('Bearer ', ''),
      FEEDGEN_DID,
      'app.bsky.feed.getFeedSkeleton',
      (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
    )
    expect(verified.aud).toBe(FEEDGEN_DID)
    expect(verified.iss).toBe(alice)
  })

  it('hydrates read-after-write embeds on the service from the header', async () => {
    const quoted = await createPost({ text: 'quoted' })
    proxyServer.state.repoRev = quoted.commit.rev
    const post = await createPost({
      text: 'quote',
      embed: {
        $type: 'app.bsky.embed.record',
        record: { uri: quoted.uri, cid: quoted.cid },
      },
    })

    const res = await fetch(
      `${network.pds.url}/xrpc/app.bsky.feed.getTimeline`,
      {
        headers: {
          ...sc.getHeaders(alice),
          'atproto-proxy': `${proxyServer.did}#atproto_test`,
        },
      },
    )
    const body = (await res.json()) as { feed: { post: { uri: string } }[] }
    expect(body.feed.map((item) => item.post.uri)).toEqual([post.uri])

    const hydration = proxyServer.requests.at(-1)
    assert(hydration)
    const hydrationUrl = new URL(hydration.url, proxyServer.url)
    expect(hydrationUrl.pathname).toBe('/xrpc/app.bsky.feed.getPosts')
    expect(hydrationUrl.searchParams.getAll('uris')).toEqual([quoted.uri])
    await expectServiceAuth(hydration, 'app.bsky.feed.getPosts')
  })

  it('fetches read-after-write thread parents on the service from the header', async () => {
    const parent = await createPost({ text: 'parent' })
    proxyServer.state.repoRev = parent.commit.rev
    const ref = { uri: parent.uri, cid: parent.cid }
    const reply = await createPost({
      text: 'reply',
      reply: { root: ref, parent: ref },
    })

    const path = `/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(reply.uri)}`
    const res = await fetch(`${network.pds.url}${path}`, {
      headers: {
        ...sc.getHeaders(alice),
        'atproto-proxy': `${proxyServer.did}#atproto_test`,
      },
    })
    const body = (await res.json()) as { thread: { post: { uri: string } } }
    expect(res.status).toBe(200)
    expect(body.thread.post.uri).toBe(reply.uri)

    const [proxied, parents] = proxyServer.requests.slice(-2)
    assert(proxied && parents)
    expect(proxied.url).toEqual(path)

    const parentsUrl = new URL(parents.url, proxyServer.url)
    expect(parentsUrl.pathname).toBe('/xrpc/app.bsky.feed.getPostThread')
    expect(parentsUrl.searchParams.get('uri')).toBe(parent.uri)
    await expectServiceAuth(parents, 'app.bsky.feed.getPostThread')
  })

  describe('com.atproto.identity.resolveHandle', () => {
    const handle = EXTERNAL_HANDLE
    const did = EXTERNAL_DID
    const path = `/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`

    it('is service proxied based on header', async () => {
      const res = await fetch(`${network.pds.url}${path}`, {
        headers: {
          ...sc.getHeaders(alice),
          'atproto-proxy': `${proxyServer.did}#atproto_test`,
        },
      })
      await res.arrayBuffer() // drain
      expect(res.status).toBe(200)

      const req = proxyServer.requests.at(-1)
      assert(req)
      expect(req.url).toEqual(path)
      assert(req.auth)
      const verified = await verifyJwt(
        req.auth.replace('Bearer ', ''),
        proxyServer.did,
        'com.atproto.identity.resolveHandle',
        (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
      )
      expect(verified.aud).toBe(proxyServer.did)
      expect(verified.iss).toBe(alice)
    })

    it('requires auth to be service proxied', async () => {
      const requestCount = proxyServer.requests.length
      const res = await fetch(`${network.pds.url}${path}`, {
        headers: { 'atproto-proxy': `${proxyServer.did}#atproto_test` },
      })
      await res.arrayBuffer() // drain
      expect(res.status).toBe(401)
      expect(proxyServer.requests.length).toBe(requestCount)
    })

    it('resolves the handle directly when the appview is unreachable', async () => {
      using resolve = jest
        .spyOn(network.pds.ctx.idResolver.handle, 'resolve')
        .mockResolvedValue(did)

      // The configured appview is unreachable in this network
      const res = await fetch(`${network.pds.url}${path}`)
      await expect(res.json()).resolves.toEqual({ did })
      expect(resolve).toHaveBeenCalledWith(handle)
    })
  })

  async function createPost(record: Record<string, unknown>) {
    const res = await fetch(
      `${network.pds.url}/xrpc/com.atproto.repo.createRecord`,
      {
        method: 'POST',
        headers: {
          ...sc.getHeaders(alice),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          repo: alice,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            createdAt: new Date().toISOString(),
            ...record,
          },
        }),
      },
    )
    assert(res.ok)
    return (await res.json()) as {
      uri: string
      cid: string
      commit: { rev: string }
    }
  }

  async function expectServiceAuth(req: ProxyReq, lxm: string) {
    assert(req.auth)
    const verified = await verifyJwt(
      req.auth.replace('Bearer ', ''),
      proxyServer.did,
      lxm,
      (iss) => network.pds.ctx.idResolver.did.resolveAtprotoKey(iss, true),
    )
    expect(verified.iss).toBe(alice)
  }
})

type ProxyState = {
  /** Sent as `atproto-repo-rev` on read-after-write endpoints */
  repoRev: string
}

type ProxyReq = {
  url: string
  auth: string | undefined
}

class ProxyServer {
  private terminator: HttpTerminator

  constructor(
    server: http.Server,
    public url: string,
    public did: string,
    public requests: ProxyReq[],
    public state: ProxyState,
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const requests: ProxyReq[] = []
    const state: ProxyState = { repoRev: '' }
    const record = (req: express.Request) => {
      requests.push({ url: req.url, auth: req.header('authorization') })
    }
    const app = express()

    // This is a PDS endpoint which uses a manual pipethrough() in its handler
    app.get('/xrpc/app.bsky.actor.getPreferences', (req, res) => {
      res.sendStatus(501)
    })

    app.get('/xrpc/com.atproto.identity.resolveHandle', (req, res) => {
      record(req)
      res.json({ did: EXTERNAL_DID })
    })

    app.get('/xrpc/app.bsky.feed.getTimeline', (req, res) => {
      record(req)
      res.setHeader('atproto-repo-rev', state.repoRev)
      res.json({ feed: [] })
    })

    app.get('/xrpc/app.bsky.feed.getPosts', (req, res) => {
      record(req)
      res.json({ posts: [] })
    })

    app.get('/xrpc/app.bsky.feed.getPostThread', (req, res) => {
      record(req)
      res.setHeader('atproto-repo-rev', state.repoRev)
      res.status(400).json({ error: 'NotFound', message: 'Post not found' })
    })

    app.get('*', (req, res) => {
      record(req)
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
    return new ProxyServer(server, url, did, requests, state)
  }

  async close(): Promise<void> {
    await this.terminator.terminate()
  }
}
