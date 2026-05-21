import { once } from 'node:events'
import { AddressInfo } from 'node:net'
import express from 'express'
import { ScopePermissions, RpcPermissionMatch } from '@atproto/oauth-scopes'
import { AppContext } from '../../src/context.js'
import { proxyHandler } from '../../src/pipethrough.js'

// Regression test for the OAuth service-proxying audience fix.
//
// Before the fix, proxyHandler passed a bare DID as `aud` to the rpc scope
// check. An OAuth caller granted `rpc:<lxm>?aud=<did>#<serviceId>` (the
// canonical scope shape used in atproto OAuth) had no way to match, so
// proxied calls failed at the scope check. The fix combines the proxied
// service id into the scope-check audience as `<did>#<serviceId>`.
//
// The test stubs only the AppContext fields proxyHandler depends on, so the
// catchall runs without a full PDS network. It captures the `aud` that
// reaches the authorize callback and asserts the combined form.

describe('proxy oauth audience', () => {
  let server: import('node:http').Server
  let serverUrl: string
  let lastAud: string | undefined

  const proxyDid = 'did:web:example.com'
  const serviceId = 'atproto_test'
  const lxm = 'app.bsky.feed.getFeed'

  beforeAll(async () => {
    const ctx = makeStubCtx({
      proxyDid,
      serviceId,
      onAud: (aud) => (lastAud = aud),
    })

    const app = express()
    app.all('/xrpc/*', proxyHandler(ctx))

    server = app.listen(0)
    await once(server, 'listening')
    serverUrl = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  beforeEach(() => {
    lastAud = undefined
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('passes combined did#serviceId aud to the rpc scope check', async () => {
    await fetch(`${serverUrl}/xrpc/${lxm}`, {
      headers: {
        'atproto-proxy': `${proxyDid}#${serviceId}`,
        'x-test-scope': `rpc:${lxm}?aud=${encodeURIComponent(`${proxyDid}#${serviceId}`)}`,
      },
    })
    expect(lastAud).toBe(`${proxyDid}#${serviceId}`)
  })

  it('matches an OAuth rpc scope granted with combined did#serviceId aud', async () => {
    // Pre-fix this would have rejected because the scope check received
    // bare-DID aud and never matched the combined-form scope.
    const res = await fetch(`${serverUrl}/xrpc/${lxm}`, {
      headers: {
        'atproto-proxy': `${proxyDid}#${serviceId}`,
        'x-test-scope': `rpc:${lxm}?aud=${encodeURIComponent(`${proxyDid}#${serviceId}`)}`,
      },
    })
    // The stub fails the upstream fetch, but the scope check runs first;
    // a 4xx here means the scope check threw before reaching the upstream.
    // Anything else (including the upstream failure) means the scope check
    // passed.
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })

  it('rejects an OAuth rpc scope granted with only bare-DID aud', async () => {
    const res = await fetch(`${serverUrl}/xrpc/${lxm}`, {
      headers: {
        'atproto-proxy': `${proxyDid}#${serviceId}`,
        'x-test-scope': `rpc:${lxm}?aud=${proxyDid}`,
      },
    })
    expect([401, 403]).toContain(res.status)
  })
})

// Stubs the minimal AppContext surface proxyHandler depends on: an
// authVerifier that runs the authorize callback against a ScopePermissions
// instance built from the `x-test-scope` header, an idResolver that returns
// a DID document with the requested service endpoint, and stubs for the
// JWT signer and config the handler reads. The proxyAgent is a tiny
// undici-shaped object whose stream() always rejects; we only care that
// the scope check ran and reported success or failure before that point.
function makeStubCtx(opts: {
  proxyDid: string
  serviceId: string
  onAud: (aud: string) => void
}): AppContext {
  const stubAuthVerifier = {
    authorization<P extends { aud: string }>({
      authorize,
    }: {
      authorize: (
        permissions: ScopePermissions,
        ctx: { params: P },
      ) => Promise<void> | void
    }) {
      return async (ctx: { req: any; res: any; params: P }) => {
        opts.onAud(ctx.params.aud)
        const scopeHeader = ctx.req.headers['x-test-scope'] as
          | string
          | undefined
        const permissions = new ScopePermissions(scopeHeader?.split(' ') ?? [])
        await authorize(permissions, ctx)
        return {
          credentials: {
            type: 'oauth' as const,
            did: 'did:plc:abcdefghijklmnopqrstuvwx',
            permissions,
          },
        }
      }
    },
  }

  const stubProxyAgent = {
    stream: () => Promise.reject(new Error('stub upstream not connected')),
    request: () => Promise.reject(new Error('stub upstream not connected')),
  }

  return {
    authVerifier: stubAuthVerifier,
    serviceAuthJwt: async () => 'stub.jwt.value',
    idResolver: {
      did: {
        resolve: async () => ({
          id: opts.proxyDid,
          service: [
            {
              id: `#${opts.serviceId}`,
              type: 'TestAtprotoService',
              serviceEndpoint: `http://localhost:1`,
            },
          ],
        }),
      },
    },
    cfg: {
      bskyAppView: undefined,
      modService: undefined,
      reportService: undefined,
      proxy: { preferCompressed: false },
    },
    proxyAgent: stubProxyAgent,
  } as unknown as AppContext
}
