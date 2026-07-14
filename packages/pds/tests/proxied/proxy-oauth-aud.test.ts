import { once } from 'node:events'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import express from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import type { Keypair } from '@atproto/crypto'
import {
  type SeedClient,
  TestNetworkNoAppView,
  usersSeed,
} from '@atproto/dev-env'
import { ScopePermissions } from '@atproto/oauth-scopes'
import type { DidString } from '@atproto/syntax'
import type { AppContext } from '../../src/context.js'
import { proxyHandler } from '../../src/pipethrough.js'

// Regression test for the OAuth service-proxying audience fix.
//
// Before the fix, proxyHandler passed a bare DID as `aud` to the rpc scope
// check. An OAuth caller granted `rpc:<lxm>?aud=<did>#<serviceId>` (the
// canonical scope shape used in atproto OAuth) had no way to match, so
// proxied calls failed at the scope check. The fix combines the proxied
// service id into the scope-check audience as `<did>#<serviceId>`.
//
// We use a real PDS AppContext (so every field is real-typed). Only the
// `authVerifier.authorization` method is replaced, with a thin stub that
// drives the OAuth path off an `x-test-scope` request header — letting us
// exercise the rpc scope check without minting a real OAuth token. A
// separate express app mounts a fresh proxyHandler against the real ctx
// and forwards to a real upstream ProxyServer.

describe('proxy oauth audience', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let alice: string
  let upstream: ProxyServer
  let terminator: httpTerminator.HttpTerminator
  let serverUrl: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'proxy_oauth_aud',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    upstream = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'atproto_test',
    )

    // Replace only the `authorization` method on the real AuthVerifier so
    // every other ctx field stays real and real-typed. The override's
    // signature is constrained by AuthVerifier['authorization']: an OAuth
    // shape change in the real verifier breaks the body of this stub at
    // compile time.
    const stubAuthorization: typeof network.pds.ctx.authVerifier.authorization =
      ({ authorize }) => {
        return async (ctx) => {
          const scopeHeader = ctx.req.headers['x-test-scope'] as
            | string
            | undefined
          const permissions = new ScopePermissions(
            scopeHeader?.split(' ') ?? [],
          )
          await authorize(permissions, ctx)
          return {
            credentials: {
              type: 'oauth',
              did: alice as DidString,
              permissions,
            },
          }
        }
      }
    network.pds.ctx.authVerifier.authorization = stubAuthorization

    const app = express()
    // dev-env exports AppContext from its built dist/, while we import
    // proxyHandler from src/. Cast at this boundary to bridge the two
    // identical shapes; downstream behavior is real.
    app.all('/xrpc/*', proxyHandler(network.pds.ctx as unknown as AppContext))
    app.use(
      (
        err: Error & { status?: number; statusCode?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        if (res.headersSent) return
        res.status(err.status ?? err.statusCode ?? 500).end()
      },
    )
    const server = app.listen(0)
    await once(server, 'listening')
    terminator = httpTerminator.createHttpTerminator({ server })
    serverUrl = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await Promise.all([
      terminator?.terminate(),
      upstream?.close(),
      network?.close(),
    ])
  })

  it('matches an OAuth rpc scope granted with combined did#serviceId aud', async () => {
    // Pre-fix this would have rejected because the scope check received
    // bare-DID aud and never matched the combined-form scope. A 200 here
    // implies the scope check ran with combined-form aud.
    const res = await fetch(`${serverUrl}/xrpc/app.bsky.feed.getFeed`, {
      headers: {
        'atproto-proxy': `${upstream.did}#atproto_test`,
        'x-test-scope': `rpc:app.bsky.feed.getFeed?aud=${encodeURIComponent(`${upstream.did}#atproto_test`)}`,
      },
    })
    expect(res.status).toBe(200)
  })

  it('rejects an OAuth rpc scope granted for a different service id', async () => {
    // Same DID, different service id — both forms parse as valid scope
    // audiences, but the runtime aud (`upstream.did#atproto_test`) doesn't
    // match the granted aud (`upstream.did#atproto_other`).
    const res = await fetch(`${serverUrl}/xrpc/app.bsky.feed.getFeed`, {
      headers: {
        'atproto-proxy': `${upstream.did}#atproto_test`,
        'x-test-scope': `rpc:app.bsky.feed.getFeed?aud=${encodeURIComponent(`${upstream.did}#atproto_other`)}`,
      },
    })
    expect([401, 403]).toContain(res.status)
  })
})

class ProxyServer {
  private terminator: httpTerminator.HttpTerminator

  constructor(
    server: http.Server,
    public url: string,
    public did: string,
  ) {
    this.terminator = httpTerminator.createHttpTerminator({ server })
  }

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const app = express()
    app.all('*', (_req, res) => res.sendStatus(200))

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
    return new ProxyServer(server, url, did)
  }

  close(): Promise<void> {
    return this.terminator.terminate()
  }
}
