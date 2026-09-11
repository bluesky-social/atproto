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
    await network.pds.ctx.idResolver.did.resolve(serviceDid, true)

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
