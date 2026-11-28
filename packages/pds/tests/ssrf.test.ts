import { once } from 'node:events'
import { type AddressInfo, type Server, createServer } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ComAtprotoModerationDefs } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { startServer } from './_util.js'

// Service endpoints are resolved out of DID documents, which are
// user-controlled, so every xrpc() call built from one goes through
// ctx.safeFetch: https-only, unicast-only destinations.
//
// These tests point a DID document's service endpoints at a local server and
// assert that no request leaves the process. The `upstreamRequests` assertion
// is the load-bearing one: a rejection alone could come from anywhere, but an
// empty request log proves the fetch never happened.

describe('ssrf protection on did-resolved service endpoints', () => {
  let upstream: AsyncDisposable & { port: number }
  let upstreamRequests: string[]

  beforeAll(async () => {
    upstream = await startServer((req, res) => {
      upstreamRequests.push(`${req.method} ${req.url}`)
      res.writeHead(200, { 'content-type': 'application/json' })
      // createReport relays the upstream response to the caller, and the PDS
      // validates it against the lexicon in dev mode, so it must be well formed.
      res.end(
        req.url?.endsWith('createReport')
          ? JSON.stringify({
              id: 1,
              reasonType: ComAtprotoModerationDefs.REASONSPAM,
              subject: {
                $type: 'com.atproto.admin.defs#repoRef',
                did: 'did:plc:abcdefghijklmnopqrstuvwx',
              },
              reportedBy: 'did:plc:abcdefghijklmnopqrstuvwx',
              createdAt: new Date().toISOString(),
            })
          : '{}',
      )
    })
  })

  beforeEach(() => {
    upstreamRequests = []
  })

  afterAll(async () => {
    await upstream?.[Symbol.asyncDispose]()
  })

  const setup = async (disableSsrfProtection: boolean) => {
    const network = await TestNetworkNoAppView.create({
      pds: { disableSsrfProtection },
    })
    const sc = network.getSeedClient()
    await sc.createAccount('reporter', {
      handle: 'reporter.test',
      email: 'reporter@test.com',
      password: 'repo-pass',
    })
    await sc.createAccount('notifsvc', {
      handle: 'notifsvc.test',
      email: 'notifsvc@test.com',
      password: 'serv-pass',
    })

    // Point the service account's DID document at the local upstream.
    const serviceDid = sc.dids.notifsvc
    const endpoint = `http://localhost:${upstream.port}`
    await network.plc
      .getClient()
      .updateData(serviceDid, network.pds.ctx.plcRotationKey, (x) => {
        x.services['bsky_notif'] = {
          type: 'BskyNotificationService',
          endpoint,
        }
        x.services['atproto_labeler'] = {
          type: 'AtprotoLabeler',
          endpoint,
        }
        return x
      })
    const serviceDoc = await network.plc.getClient().getDocument(serviceDid)
    await network.pds.ctx.idResolver.did.cache?.cacheDid(serviceDid, serviceDoc)

    const agent = network.pds.getAgent()
    const headers = sc.getHeaders(sc.dids.reporter)
    const pushInput = {
      serviceDid,
      token: 'tok1',
      platform: 'web' as const,
      appId: 'app1',
    }
    const reportInput = {
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      reason: 'ssrf probe',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.reporter,
      },
    }

    return {
      network,
      registerPush: () =>
        agent.api.app.bsky.notification.registerPush(pushInput, {
          headers,
          encoding: 'application/json',
        }),
      unregisterPush: () =>
        agent.api.app.bsky.notification.unregisterPush(pushInput, {
          headers,
          encoding: 'application/json',
        }),
      createReport: () =>
        agent.api.com.atproto.moderation.createReport(reportInput, {
          headers: {
            ...headers,
            'atproto-proxy': `${serviceDid}#atproto_labeler`,
          },
          encoding: 'application/json',
        }),
    }
  }

  const settle = (promise: Promise<unknown>) =>
    promise.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    )

  describe('with ssrf protection enabled', () => {
    let ctx: Awaited<ReturnType<typeof setup>>

    beforeAll(async () => {
      ctx = await setup(false)
    })

    afterAll(async () => {
      await ctx?.network.close()
    })

    it('refuses to send registerPush to a non-unicast endpoint.', async () => {
      const outcome = await settle(ctx.registerPush())
      expect(upstreamRequests).toEqual([])
      expect(outcome).toBe('rejected')
    })

    it('refuses to send unregisterPush to a non-unicast endpoint.', async () => {
      const outcome = await settle(ctx.unregisterPush())
      expect(upstreamRequests).toEqual([])
      expect(outcome).toBe('rejected')
    })

    it('refuses to send createReport to a non-unicast endpoint.', async () => {
      const outcome = await settle(ctx.createReport())
      expect(upstreamRequests).toEqual([])
      expect(outcome).toBe('rejected')
    })
  })

  // Differential control: the same endpoints, the same calls, with the guard
  // turned off. Without this, the tests above could pass for the wrong reason
  // (e.g. a DID document the PDS never managed to resolve) and we would not
  // notice that they had stopped testing anything.
  describe('with ssrf protection disabled', () => {
    let ctx: Awaited<ReturnType<typeof setup>>

    beforeAll(async () => {
      ctx = await setup(true)
    })

    afterAll(async () => {
      await ctx?.network.close()
    })

    it('sends registerPush to the endpoint.', async () => {
      await ctx.registerPush()
      expect(upstreamRequests).toEqual([
        'POST /xrpc/app.bsky.notification.registerPush',
      ])
    })

    it('sends unregisterPush to the endpoint.', async () => {
      await ctx.unregisterPush()
      expect(upstreamRequests).toEqual([
        'POST /xrpc/app.bsky.notification.unregisterPush',
      ])
    })

    it('sends createReport to the endpoint.', async () => {
      await ctx.createReport()
      expect(upstreamRequests).toEqual([
        'POST /xrpc/com.atproto.moderation.createReport',
      ])
    })
  })
})

// The proxy reaches the configured AppView through its own agent, without SSRF
// protection, because the operator sets that URL. Every other proxy target,
// including a DID document's service endpoint, goes through ctx.proxyAgent.
describe('ssrf protection on proxied requests', () => {
  const appViewDid = 'did:example:appview'

  let appView: AsyncDisposable & { port: number }
  let appViewRequests: string[]

  // A DID document's service endpoint on a private address. It is https so
  // that only the address check, not the protocol check, can refuse it. It
  // counts connections rather than requests because a request that got
  // through would fail the TLS handshake before any HTTP was parsed.
  let privateTarget: Server
  let privateTargetConnections: number

  beforeAll(async () => {
    appView = await startServer((req, res) => {
      appViewRequests.push(`${req.method} ${req.url}`)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })

    privateTarget = createServer((socket) => {
      privateTargetConnections++
      socket.destroy()
    }).listen(0, '127.0.0.1')
    await once(privateTarget, 'listening')
  })

  beforeEach(() => {
    appViewRequests = []
    privateTargetConnections = 0
  })

  afterAll(async () => {
    await appView?.[Symbol.asyncDispose]()
    privateTarget?.close()
  })

  const setup = async (disableSsrfProtection: boolean) => {
    const network = await TestNetworkNoAppView.create({
      pds: {
        disableSsrfProtection,
        bskyAppViewUrl: `http://localhost:${appView.port}`,
        bskyAppViewDid: appViewDid,
      },
    })
    const sc = network.getSeedClient()
    await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    await sc.createAccount('proxysvc', {
      handle: 'proxysvc.test',
      email: 'proxysvc@test.com',
      password: 'proxysvc-pass',
    })

    const alice = sc.dids.alice
    const serviceDid = sc.dids.proxysvc
    const { port } = privateTarget.address() as AddressInfo
    await network.plc
      .getClient()
      .updateData(serviceDid, network.pds.ctx.plcRotationKey, (x) => {
        x.services['atproto_test'] = {
          type: 'AtprotoTest',
          endpoint: `https://127.0.0.1:${port}`,
        }
        return x
      })
    const serviceDoc = await network.plc.getClient().getDocument(serviceDid)
    await network.pds.ctx.idResolver.did.cache?.cacheDid(serviceDid, serviceDoc)

    const headers = sc.getHeaders(alice)
    const get = async (path: string, proxyTo?: string) => {
      const res = await fetch(`${network.pds.url}${path}`, {
        headers: proxyTo ? { ...headers, 'atproto-proxy': proxyTo } : headers,
      })
      await res.arrayBuffer()
      return res.status
    }

    return {
      network,
      // Handled by the catchall proxyHandler.
      catchall: (proxyTo?: string) => get('/xrpc/com.example.ok', proxyTo),
      // Handled by a route that calls pipethrough().
      getProfile: (proxyTo?: string) =>
        get(`/xrpc/app.bsky.actor.getProfile?actor=${alice}`, proxyTo),
      alice,
      serviceProxyTo: `${serviceDid}#atproto_test`,
    }
  }

  describe('with ssrf protection enabled', () => {
    let ctx: Awaited<ReturnType<typeof setup>>

    beforeAll(async () => {
      ctx = await setup(false)
    })

    afterAll(async () => {
      await ctx?.network.close()
    })

    it('proxies to the configured AppView at a private address.', async () => {
      expect(await ctx.catchall()).toBe(200)
      expect(await ctx.getProfile()).toBe(200)
      expect(appViewRequests).toEqual([
        'GET /xrpc/com.example.ok',
        `GET /xrpc/app.bsky.actor.getProfile?actor=${ctx.alice}`,
      ])
    })

    it('proxies to the configured AppView named by the atproto-proxy header.', async () => {
      const proxyTo = `${appViewDid}#bsky_appview`
      expect(await ctx.catchall(proxyTo)).toBe(200)
      expect(await ctx.getProfile(proxyTo)).toBe(200)
      expect(appViewRequests).toEqual([
        'GET /xrpc/com.example.ok',
        `GET /xrpc/app.bsky.actor.getProfile?actor=${ctx.alice}`,
      ])
    })

    it('refuses to proxy to a DID document endpoint at a private address.', async () => {
      expect(await ctx.catchall(ctx.serviceProxyTo)).toBe(502)
      expect(await ctx.getProfile(ctx.serviceProxyTo)).toBe(502)
      expect(privateTargetConnections).toBe(0)
    })
  })

  // Differential control, as above: the same DID document endpoint is reached
  // once the guard is off, so the refusal above is the guard's doing.
  describe('with ssrf protection disabled', () => {
    let ctx: Awaited<ReturnType<typeof setup>>

    beforeAll(async () => {
      ctx = await setup(true)
    })

    afterAll(async () => {
      await ctx?.network.close()
    })

    it('connects to a DID document endpoint at a private address.', async () => {
      await ctx.catchall(ctx.serviceProxyTo)
      expect(privateTargetConnections).toBe(1)
      await ctx.getProfile(ctx.serviceProxyTo)
      expect(privateTargetConnections).toBe(2)
    })
  })
})
