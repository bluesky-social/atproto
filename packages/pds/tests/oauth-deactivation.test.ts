import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type Browser, launch } from 'puppeteer'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import {
  Client,
  type DidString,
  XrpcAuthenticationError,
  XrpcResponseError,
} from '@atproto/lex'
import {
  NodeOAuthClient,
  type OAuthSession,
  buildAtprotoLoopbackClientMetadata,
  requestLocalLock,
} from '@atproto/oauth-client-node'
import { com } from '../src/lexicons/index.js'
import { PageHelper } from './_puppeteer.js'

const languages = ['fr-BE', 'fr', 'en-US', 'en']

const mapStore = <V>() => {
  const map = new Map<string, V>()
  return {
    get: async (key: string) => map.get(key),
    set: async (key: string, value: V) => {
      map.set(key, value)
    },
    del: async (key: string) => {
      map.delete(key)
    },
  }
}

describe('account deactivation over OAuth', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let alice: DidString

  let redirectServer: Server
  let redirectUri: string
  let onRedirect: ((params: URLSearchParams) => void) | undefined

  let unscopedClient: Client
  let scopedClient: Client
  let scopedSession: OAuthSession

  const authorize = async (scope: string): Promise<OAuthSession> => {
    const oauthClient = new NodeOAuthClient({
      clientMetadata: buildAtprotoLoopbackClientMetadata({
        scope,
        redirect_uris: [redirectUri],
      }),
      allowHttp: true,
      handleResolver: network.pds.url,
      plcDirectoryUrl: network.plc.url,
      requestLock: requestLocalLock,
      stateStore: mapStore(),
      sessionStore: mapStore(),
    })

    const authorizeUrl = await oauthClient.authorize('alice.test')

    const redirected = new Promise<URLSearchParams>((resolve) => {
      onRedirect = resolve
    })

    await using page = await PageHelper.from(browser, { languages })

    await page.goto(authorizeUrl)

    await page.assertTitle('Connexion')
    await page.typeInInput('password', 'alice-pass')
    await page.clickOnText('Se connecter')

    await page.assertTitle('Autoriser')

    await page.navigationClick('Autoriser')

    const { session } = await oauthClient.callback(await redirected)
    return session
  }

  beforeAll(async () => {
    browser = await launch({ browser: 'chrome' })

    network = await TestNetworkNoAppView.create({})

    sc = network.getSeedClient()
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = sc.dids.alice

    redirectServer = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      onRedirect?.(url.searchParams)
      onRedirect = undefined
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
    })
    redirectServer.listen(0, '127.0.0.1')
    await once(redirectServer, 'listening')
    const { port } = redirectServer.address() as AddressInfo
    redirectUri = `http://127.0.0.1:${port}/callback`

    const unscopedSession = await authorize('atproto')
    unscopedClient = new Client(unscopedSession)

    scopedSession = await authorize('atproto account:status?action=manage')
    scopedClient = new Client(scopedSession)
  })

  afterAll(async () => {
    redirectServer?.close()
    await network?.close()
    await browser?.close()
  })

  it('rejects deactivation when the session lacks the status scope', async () => {
    await expect(
      unscopedClient.xrpc(com.atproto.server.deactivateAccount, { body: {} }),
    ).rejects.toMatchObject({
      constructor: XrpcResponseError,
      error: 'ScopeMissingError',
      message: expect.stringContaining('account:status?action=manage'),
    })
  })

  it('rejects reactivation over OAuth with a message pointing at the account page', async () => {
    await expect(
      scopedClient.xrpc(com.atproto.server.activateAccount),
    ).rejects.toMatchObject({
      constructor: XrpcResponseError,
      message: expect.stringContaining('account management page'),
    })
  })

  it('deactivates the account when the status scope is granted', async () => {
    const agent = network.pds.getAgent()
    await agent.com.atproto.server.createAppPassword(
      { name: 'before-deactivation' },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )

    await scopedClient.xrpc(com.atproto.server.deactivateAccount, { body: {} })
    await network.processAll()

    const status = await agent.com.atproto.sync.getRepoStatus({ did: alice })
    expect(status.data).toEqual({
      did: alice,
      active: false,
      status: 'deactivated',
    })
  })

  it('revokes app passwords on OAuth deactivation', async () => {
    await expect(
      network.pds.ctx.accountManager.listAppPasswords(alice),
    ).resolves.toEqual([])
  })

  it('revokes the OAuth session that performed the deactivation', async () => {
    await expect(
      scopedClient.xrpc(com.atproto.server.getSession),
    ).rejects.toMatchObject({
      constructor: XrpcAuthenticationError,
      response: expect.objectContaining({ status: 401 }),
    })
  })
})
