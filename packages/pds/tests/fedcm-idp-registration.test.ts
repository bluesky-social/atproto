import assert from 'node:assert'
import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import type { AddressInfo } from 'node:net'
import { type Browser, launch } from 'puppeteer'
import { verifySignature } from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { type DidString, asStringFormat } from '@atproto/lex'
import { middleware as oauthClientAssetsMiddleware } from '@atproto/oauth-client-browser-example/server'
import {
  FedcmPage,
  browserDescribe,
  captureFedcmToken,
  closeServers,
  createTlsCredentials,
  fedcmBrowserArgs,
  nextDialog,
  readFedcmToken,
} from './_fedcm.js'

const idpOrigin = 'https://idp-one.test'
const configUrl = `${idpOrigin}/oauth/fedcm/config.json`

type RegistrationWindow = Window & {
  IdentityProvider?: { register?: (configUrl: string) => Promise<boolean> }
  __fedcmRegistered?: Promise<boolean>
}

type SetStatusNavigator = {
  login?: { setStatus?: (...args: unknown[]) => unknown }
}
type SetStatusWindow = Window & {
  __fedcmSetStatusCalls?: unknown[][]
  __sessions?: { loginRequired: boolean }[]
}

browserDescribe('FedCM IdP registration in Chrome', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let tlsServer: Server
  let rpServer: Server
  let appUrl: string
  let authnAppUrl: string
  let rpOrigin: string
  let alice: DidString
  const requests: {
    host: string
    path: string
    method?: string
    status?: number
  }[] = []

  beforeAll(async () => {
    const tls = await createTlsCredentials('idp-one.test')

    network = await TestNetworkNoAppView.create({
      pds: {
        hostname: 'idp-one.test',
        oauthFedcmEnabled: true,
        oauthFedcmAllowLoopbackClients: true,
      },
    })
    const account = await network.getSeedClient().createAccount('alice', {
      handle: asStringFormat('alice.test', 'handle'),
      email: 'alice@example.com',
      password: 'alice-pass',
    })
    alice = account.did
    await network.processAll()

    tlsServer = createHttpsServer(tls, (req, res) => {
      const host = req.headers.host ?? ''
      const path = new URL(req.url ?? '/', `https://${host}`).pathname
      const request = { host, path, method: req.method, status: 0 }
      requests.push(request)
      res.on('finish', () => {
        request.status = res.statusCode
      })
      network.pds.server.app(req, res)
    })
    tlsServer.listen(0, '127.0.0.1')
    await once(tlsServer, 'listening')
    const tlsPort = (tlsServer.address() as AddressInfo).port

    browser = await launch({
      args: [
        ...fedcmBrowserArgs(tlsPort, ['idp-one.test']),
        '--enable-features=FedCmIdPRegistration,FedCmLightweightMode',
      ],
    })
    const version = await browser.version()
    assert(Number(version.match(/\/(\d+)/)?.[1]) >= 141, version)

    await using idpPage = new FedcmPage(await browser.newPage())
    await idpPage.goto(`${idpOrigin}/account/sign-in`)
    const response = await idpPage.api('/sign-in', {
      identifier: 'alice.test',
      password: 'alice-pass',
      remember: true,
      locale: 'en',
    })
    expect(response).toMatchObject({ status: 200, loginStatus: 'logged-in' })

    // @NOTE Observe (without altering) the UI's registration call, so the
    // tests start only once Chrome has registered the IdP.
    await idpPage.page.evaluateOnNewDocument(() => {
      const idp = (window as RegistrationWindow).IdentityProvider
      const register = idp?.register
      if (!idp || !register) return
      idp.register = (url) => {
        const registered = register.call(idp, url)
        ;(window as RegistrationWindow).__fedcmRegistered = registered
        return registered
      }
    })
    // The sign-in API pushes nothing: the account page's code does.
    await idpPage.goto(`${idpOrigin}/account`)
    await idpPage.page.waitForFunction(
      () => (window as RegistrationWindow).__fedcmRegistered !== undefined,
      { timeout: 10_000 },
    )
    await expect(
      idpPage.page.evaluate(
        () => (window as RegistrationWindow).__fedcmRegistered,
      ),
    ).resolves.toBe(true)

    rpServer = createServer(oauthClientAssetsMiddleware)
    rpServer.listen(0, '127.0.0.1')
    await once(rpServer, 'listening')
    const rpPort = (rpServer.address() as AddressInfo).port
    const params = new URLSearchParams({
      env: 'test',
      plc_directory_url: network.plc.url,
      pds_operator_url: idpOrigin,
      handle_resolver: network.pds.url,
      scope: 'atproto account:email account:status',
      fedcm_idp_registration: 'true',
    })
    appUrl = `http://127.0.0.1:${rpPort}/?${params}`
    params.set('scope', 'atproto')
    authnAppUrl = `http://127.0.0.1:${rpPort}/?${params}`
    rpOrigin = `http://127.0.0.1:${rpPort}`
    requests.length = 0
  })

  let cleanup: (() => void) | undefined
  afterEach(async () => {
    cleanup?.()
    cleanup = undefined
    // The identity session lives in the app origin's localStorage and would
    // leak into later tests.
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.page.createCDPSession()
    await cdp.send('Storage.clearDataForOrigin', {
      origin: rpOrigin,
      storageTypes: 'local_storage',
    })
  })

  afterAll(async () => {
    await browser?.close()
    await closeServers([tlsServer, rpServer])
    await network?.close()
  })

  it('offers a registered PDS account to an app that names no provider', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    expect(dialog.dialogType).toBe('AccountChooser')
    expect(dialog.accounts).toEqual([
      expect.objectContaining({ accountId: alice, idpConfigUrl: configUrl }),
    ])
    expect(parRequests()).toHaveLength(0)

    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: 0,
    })
    await page.ensureTextVisibility('Authorize', 'button')
    // @NOTE A nonce challenge can retry the POST; only one PAR is created.
    expect(parRequests().filter((r) => r.status === 201)).toHaveLength(1)
    const assertionIndex = requests.findIndex(
      (r) => r.path === '/oauth/fedcm/assertion',
    )
    expect(assertionIndex).toBeGreaterThanOrEqual(0)
    expect(requests.findIndex((r) => r.path === '/oauth/par')).toBeGreaterThan(
      assertionIndex,
    )
  })

  it('keeps the account pushed from a prompt=login authorization page', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    await page.page.evaluateOnNewDocument((idpOrigin) => {
      if (location.origin !== idpOrigin) return
      const login = (navigator as unknown as SetStatusNavigator).login
      const setStatus = login?.setStatus
      if (!login || !setStatus) return
      const calls: unknown[][] = []
      ;(window as SetStatusWindow).__fedcmSetStatusCalls = calls
      login.setStatus = (...args) => {
        calls.push(args)
        return setStatus.apply(login, args)
      }
    }, idpOrigin)
    // The example app never sends `prompt`; add `prompt=login` to its PAR
    // body. A public client's prompt is forced to `consent` unless trusted,
    // so trust its client_id for this test.
    const provider = network.pds.ctx.cfg.oauth.provider
    assert(provider)
    const { trustedClients } = provider
    cleanup = () => {
      provider.trustedClients = trustedClients
    }
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*/oauth/par', requestStage: 'Request' }],
    })
    cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
      const body =
        request.method === 'POST' && request.postData != null
          ? new URLSearchParams(request.postData)
          : undefined
      const clientId = body?.get('client_id')
      if (body && clientId) {
        provider.trustedClients = [...(trustedClients ?? []), clientId]
        body.set('prompt', 'login')
      }
      void cdp
        .send('Fetch.continueRequest', {
          requestId,
          ...(body && {
            postData: Buffer.from(body.toString()).toString('base64'),
          }),
        })
        .catch(() => {})
    })

    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: 0,
    })
    await page.page.waitForSelector('input[name="password"]', {
      visible: true,
    })
    expect(parRequests().filter((r) => r.status === 201)).toHaveLength(1)
    // Precondition: the server flagged every session as login-required.
    await expect(
      page.page.evaluate(() =>
        (window as SetStatusWindow).__sessions?.map((s) => s.loginRequired),
      ),
    ).resolves.toEqual([true])
    await page.page.waitForFunction(
      () => Boolean((window as SetStatusWindow).__fedcmSetStatusCalls?.length),
      { timeout: 10_000 },
    )
    const calls = await page.page.evaluate(
      () => (window as SetStatusWindow).__fedcmSetStatusCalls,
    )
    expect(calls).not.toContainEqual(['logged-out'])
    expect(calls?.[0]).toEqual([
      'logged-in',
      {
        accounts: [expect.objectContaining({ id: alice })],
        expiration: expect.any(Number),
      },
    ])

    await using next = new FedcmPage(await browser.newPage())
    const nextCdp = await next.cdp()
    const nextShown = nextDialog(nextCdp)
    await next.goto(appUrl)
    const nextDialogShown = await nextShown
    expect(nextDialogShown.accounts).toEqual([
      expect.objectContaining({ accountId: alice, idpConfigUrl: configUrl }),
    ])
    await nextCdp.send('FedCm.dismissDialog', {
      dialogId: nextDialogShown.dialogId,
    })
  })

  async function signInWithFedcm(page: FedcmPage) {
    const cdp = await page.cdp()
    await captureFedcmToken(page.page)
    const shown = nextDialog(cdp)
    await page.goto(authnAppUrl)
    const dialog = await shown
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: 0,
    })
    await page.ensureTextVisibility('Signed in with FedCM', 'h1')
    return cdp
  }

  it('signs in with a verified token and no OAuth when scope is atproto', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    await signInWithFedcm(page)
    await page.ensureTextVisibility('@alice.test', 'dd')
    await page.ensureTextVisibility(alice, 'dd')
    expect(
      requests.filter((r) => r.path === '/oauth/fedcm/assertion'),
    ).toMatchObject([{ method: 'POST', status: 200 }])
    expect(parRequests()).toHaveLength(0)

    const token = await readFedcmToken(page.page)
    assert(token)
    const [header, payload, signature] = token.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    expect(
      JSON.parse(Buffer.from(header, 'base64url').toString()),
    ).toMatchObject({ typ: 'atproto-id+jwt' })
    expect(claims).toMatchObject({
      iss: alice,
      sub: alice,
      auth_time: expect.any(Number),
    })
    // The loopback client_id names this app's redirect URI and scope.
    const aud = new URL(claims.aud)
    expect(aud.origin).toBe('http://localhost')
    expect(aud.searchParams.get('redirect_uri')).toMatch(
      new RegExp(`^${rpOrigin}/`),
    )
    expect(aud.searchParams.get('scope')?.split(' ')).toContain('atproto')
    const key = await network.pds.ctx.idResolver.did.resolveAtprotoKey(alice)
    expect(
      await verifySignature(
        key,
        Buffer.from(`${header}.${payload}`),
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true)
  })

  it('identity session survives a reload', async () => {
    await using page = new FedcmPage(await browser.newPage())
    await signInWithFedcm(page)
    await page.page.reload()
    await page.ensureTextVisibility('Signed in with FedCM', 'h1')
    await page.ensureTextVisibility('@alice.test', 'dd')
  })

  it('sign out clears the identity session and reload stays signed out', async () => {
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await signInWithFedcm(page)
    // Passive FedCM re-runs after sign out and shows the chooser again.
    const shown = nextDialog(cdp)
    await page.clickOnAriaLabel('User menu')
    await page.clickOnText('Sign out')
    const dialog = await shown
    await cdp.send('FedCm.dismissDialog', { dialogId: dialog.dialogId })
    expect(await page.page.$('h1::-p-text(Signed in with FedCM)')).toBeNull()

    const reshown = nextDialog(cdp)
    await page.page.reload()
    const redialog = await reshown
    await cdp.send('FedCm.dismissDialog', { dialogId: redialog.dialogId })
    expect(await page.page.$('h1::-p-text(Signed in with FedCM)')).toBeNull()
  })

  // @NOTE Runs last among the dialog tests: it deletes the IdP cookies, so
  // later page loads see no device session.
  it('completes for a pushed account whose device session is gone', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    // @NOTE Storage.getCookies, unlike Network.getCookies({ urls }), also
    // returns the path-scoped fedcm-* cookies.
    const idpCookies = async () =>
      (await cdp.send('Storage.getCookies')).cookies.filter(
        (c) => c.domain === new URL(idpOrigin).hostname,
      )
    const cookies = await idpCookies()
    expect(cookies.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'dev-id',
        'ses-id',
        'fedcm-dev-id',
        'fedcm-ses-id',
      ]),
    )
    for (const { name, domain, path } of cookies) {
      await cdp.send('Network.deleteCookies', { name, domain, path })
    }
    await expect(idpCookies()).resolves.toEqual([])

    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    expect(dialog.dialogType).toBe('AccountChooser')
    expect(dialog.accounts).toEqual([
      expect.objectContaining({ accountId: alice, idpConfigUrl: configUrl }),
    ])
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: 0,
    })

    // @NOTE The sign-in form is visible behind the chooser, so wait for the
    // refusal itself, then for the app to finish handling it.
    const deadline = Date.now() + 10_000
    while (
      !requests.some((r) => r.path === '/oauth/fedcm/assertion' && r.status) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(
      requests.filter((r) => r.path === '/oauth/fedcm/assertion'),
    ).toMatchObject([{ method: 'POST', status: 401 }])
    await page.waitForNetworkIdle()
    await page.page.waitForSelector('input[name="identifier"]', {
      visible: true,
    })
    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')
    expect(parRequests()).toHaveLength(0)
    expect(await page.page.$('button::-p-text(Authorize)')).toBeNull()
  })

  it('rejects active mode combined with an explicit provider', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const activeUrl = new URL(appUrl)
    activeUrl.searchParams.set('fedcm_mode', 'active')
    activeUrl.searchParams.append('fedcm_provider', configUrl)

    await page.goto(activeUrl.href)
    await page.ensureTextVisibility(
      'Active FedCM requires exactly one provider.',
      'p',
    )
    await page.waitForNetworkIdle()
    expect(requests.filter((r) => r.path.startsWith('/oauth/'))).toEqual([])
    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')
  })

  function parRequests() {
    return requests.filter(
      (r) => r.path === '/oauth/par' && r.method === 'POST',
    )
  }
})
