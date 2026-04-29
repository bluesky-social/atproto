import { once } from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import express from 'express'
import { exportPKCS8, generateKeyPair } from 'jose'
import { type Browser, launch } from 'puppeteer'
import { Agent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { JoseKey } from '@atproto/jwk-jose'
import {
  NodeOAuthClient,
  NodeSavedSession,
  NodeSavedState,
} from '@atproto/oauth-client-node'
import { PageHelper } from '../_puppeteer.js'

describe('proxy catchall scope check', () => {
  // Regression for an aud-form mismatch in the PDS pipethrough catchall.
  // Explicit handlers (e.g. getTimeline) check scope against the full
  // did#service form returned by computeProxyTo. The catchall used to check
  // against parseProxyInfo().did (bare DID), so RPCs in the
  // app.bsky.authViewAll permission set without an explicit handler — like
  // app.bsky.graph.getLists — were rejected with InsufficientScope even
  // when the granted token authorized the proxied aud.

  let browser: Browser
  let network: TestNetworkNoAppView
  let alice: { did: string }
  let proxyServer: ProxyServer
  let callbackServer: http.Server
  let callbackUrl: string
  let oauthClient: NodeOAuthClient
  let scope: string

  beforeAll(async () => {
    browser = await launch({ browser: 'chrome' })

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'pipethrough_scope_check',
    })

    const sc = network.getSeedClient()
    const aliceAccount = await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = { did: aliceAccount.did }
    await network.processAll()

    proxyServer = await ProxyServer.create(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'bsky_appview',
    )

    // Granted scope authorizes the lxm against the FULL did#service form.
    // If the PDS catchall passes the bare DID to assertRpc, this scope will
    // not match and the request fails — that is the bug under test.
    scope = `atproto rpc:app.bsky.graph.getLists?aud=${encodeURIComponent(`${proxyServer.did}#bsky_appview`)}`

    callbackServer = http.createServer((req, res) => {
      res
        .writeHead(200, { 'content-type': 'text/html' })
        .end('<html><title>OAuth callback</title><body>OK</body></html>')
    })
    callbackServer.listen(0)
    await once(callbackServer, 'listening')
    const callbackPort = (callbackServer.address() as AddressInfo).port
    callbackUrl = `http://127.0.0.1:${callbackPort}/callback`

    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    const pkcs8 = await exportPKCS8(privateKey)
    const key = await JoseKey.fromImportable(pkcs8, 'key1')

    const baseUrl = `http://127.0.0.1:${callbackPort}`
    const clientId = `http://localhost?redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}`

    const stateRows = new Map<string, NodeSavedState>()
    const sessionRows = new Map<string, NodeSavedSession>()

    oauthClient = new NodeOAuthClient({
      clientMetadata: {
        client_name: 'pipethrough scope check test',
        client_id: clientId,
        client_uri: baseUrl,
        redirect_uris: [callbackUrl],
        scope,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        application_type: 'web',
        token_endpoint_auth_method: 'private_key_jwt',
        token_endpoint_auth_signing_alg: 'ES256',
        dpop_bound_access_tokens: true,
      },
      keyset: [key],
      // Test network uses HTTP for everything; the resolver chain (PDS for
      // handle → PLC for DID doc) must use the test PLC.
      allowHttp: true,
      handleResolver: network.pds.url,
      plcDirectoryUrl: network.plc.url,
      stateStore: {
        get: async (k) => stateRows.get(k),
        set: async (k, v) => {
          stateRows.set(k, v)
        },
        del: async (k) => {
          stateRows.delete(k)
        },
      },
      sessionStore: {
        get: async (k) => sessionRows.get(k),
        set: async (k, v) => {
          sessionRows.set(k, v)
        },
        del: async (k) => {
          sessionRows.delete(k)
        },
      },
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      callbackServer?.close((err) => (err ? reject(err) : resolve())),
    )
    await proxyServer?.close()
    await network?.close()
    await browser?.close()
  })

  it('passes the full did#service aud form to assertRpc for catchall RPCs', async () => {
    const authUrl = await oauthClient.authorize('alice.test', { scope })

    const page = await PageHelper.from(browser)
    try {
      await page.goto(authUrl.toString())

      // The authorize URL includes login_hint=alice.test, so the PDS
      // sign-in form pre-fills the username field as readonly. Just type
      // the password and submit.
      await page.typeInInput('password', 'alice-pass')
      await page.clickOnText('Sign in')

      // Authorize the request — the click triggers a full navigation
      // back to our callback URL.
      await page.navigationClick('Authorize')

      // Page is now on the callback URL. Extract search params and
      // exchange the code for a session.
      const params = new URL(page.url()).searchParams
      const { session } = await oauthClient.callback(params)

      // Use the session via Agent.withProxy so each XRPC request includes
      // atproto-proxy: <proxyDid>#bsky_appview, exercising the catchall.
      const agent = new Agent(session).withProxy(
        'bsky_appview',
        proxyServer.did as `did:${string}`,
      )

      // Pre-fix: the PDS rejects this with InsufficientScope because it
      // checks the granted scope against the bare proxyDid (no #service).
      // Post-fix: the PDS checks against the full did#service form, the
      // scope matches, and the request reaches our fake proxy server.
      await expect(
        agent.app.bsky.graph.getLists({ actor: alice.did, limit: 1 }),
      ).resolves.toMatchObject({ success: true, data: { lists: [] } })
    } finally {
      await page[Symbol.asyncDispose]()
    }
  })
})

class ProxyServer {
  constructor(
    private server: http.Server,
    public did: string,
  ) {}

  static async create(
    plcClient: plc.Client,
    keypair: Keypair,
    serviceId: string,
  ): Promise<ProxyServer> {
    const app = express()

    app.get('/xrpc/app.bsky.graph.getLists', (req, res) => {
      res
        .status(200)
        .setHeader('content-type', 'application/json')
        .send('{"lists":[]}')
    })

    const server = app.listen(0)
    server.keepAliveTimeout = 30 * 1000
    server.headersTimeout = 35 * 1000
    await once(server, 'listening')
    const { port } = server.address() as AddressInfo

    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [serviceId]: {
            type: 'TestAtprotoService',
            endpoint: `http://localhost:${port}`,
          },
        },
        prev: null,
      },
      keypair,
    )
    const did = await plc.didForCreateOp(plcOp)
    await plcClient.sendOperation(did, plcOp)
    return new ProxyServer(server, did)
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}
