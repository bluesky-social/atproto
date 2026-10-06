import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { type Server, createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Browser, type CDPSession, type Page, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { type DidString, asStringFormat } from '@atproto/lex'
import { middleware as oauthClientAssetsMiddleware } from '@atproto/oauth-client-browser-example/server'
import { PageHelper } from './_puppeteer.js'

const idpOrigin = 'https://idp-one.test'
const otherOrigin = 'https://idp-two.test'
const configUrl = `${idpOrigin}/oauth/fedcm/config.json`
const otherConfigUrl = `${otherOrigin}/config.json`

type Dialog = {
  dialogId: string
  dialogType: string
  accounts: { accountId: string; idpConfigUrl: string }[]
}

// @NOTE Puppeteer's pinned Chrome predates username-only and multi-IdP support.
const browserDescribe = process.env.PUPPETEER_EXECUTABLE_PATH
  ? describe
  : describe.skip

browserDescribe('account-first FedCM in Chrome 141+', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let tlsServer: Server
  let rpServer: Server
  let certDirectory: string
  let appUrl: string
  let dids: DidString[]
  const requests: {
    host: string
    path: string
    method?: string
    status?: number
    cookie?: string
  }[] = []

  beforeAll(async () => {
    certDirectory = await mkdtemp(join(tmpdir(), 'atproto-fedcm-tls-'))
    const keyPath = join(certDirectory, 'key.pem')
    const certPath = join(certDirectory, 'cert.pem')
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=idp-one.test',
        '-keyout',
        keyPath,
        '-out',
        certPath,
      ],
      { stdio: 'ignore' },
    )

    network = await TestNetworkNoAppView.create({
      pds: {
        hostname: 'idp-one.test',
        oauthFedcmEnabled: true,
        oauthFedcmAllowLoopbackClients: true,
      },
    })
    const seed = network.getSeedClient()
    dids = []
    for (const name of ['alice', 'bob', 'carla']) {
      const account = await seed.createAccount(name, {
        handle: asStringFormat(`${name}.test`, 'handle'),
        email: `${name}@example.com`,
        password: `${name}-pass`,
      })
      dids.push(account.did)
    }
    await network.processAll()

    tlsServer = createHttpsServer(
      {
        key: await readFile(keyPath),
        cert: await readFile(certPath),
      },
      (req, res) => {
        const host = req.headers.host ?? ''
        const path = new URL(req.url ?? '/', `https://${host}`).pathname
        const request = {
          host,
          path,
          method: req.method,
          status: 0,
          cookie: req.headers.cookie,
        }
        requests.push(request)
        res.on('finish', () => {
          request.status = res.statusCode
        })
        if (path === '/oauth/fedcm/cookie-probe') {
          res.setHeader('Content-Type', 'text/html')
          res.end('<!doctype html><title>Cookie probe</title>')
        } else if (host === 'idp-one.test') {
          network.pds.server.app(req, res)
        } else {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          if (path === '/.well-known/web-identity') {
            res.end(JSON.stringify({ provider_urls: [otherConfigUrl] }))
          } else if (path === '/config.json') {
            res.end(
              JSON.stringify({
                accounts_endpoint: `${otherOrigin}/accounts`,
                id_assertion_endpoint: `${otherOrigin}/assertion`,
                login_url: `${otherOrigin}/account`,
              }),
            )
          } else if (path === '/account') {
            res.setHeader('Set-Login', 'logged-in')
            res.setHeader(
              'Set-Cookie',
              'other-session=active; Secure; SameSite=None; HttpOnly',
            )
            res.end('{}')
          } else if (path === '/accounts') {
            res.end(
              JSON.stringify({
                accounts: [
                  {
                    id: 'external-1',
                    username: 'external-one',
                    name: 'External One',
                  },
                  {
                    id: 'external-2',
                    username: 'external-two',
                    name: 'External Two',
                  },
                ],
              }),
            )
          } else if (path === '/assertion') {
            res.setHeader(
              'Access-Control-Allow-Origin',
              req.headers.origin ?? '',
            )
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            req.resume()
            req.on('end', () =>
              res.end(JSON.stringify({ token: 'external-user' })),
            )
          } else {
            res.writeHead(404).end('{}')
          }
        }
      },
    )
    tlsServer.listen(0, '127.0.0.1')
    await once(tlsServer, 'listening')
    const tlsPort = (tlsServer.address() as AddressInfo).port

    browser = await launch({
      args: [
        '--ignore-certificate-errors',
        '--no-proxy-server',
        `--host-resolver-rules=MAP idp-one.test 127.0.0.1:${tlsPort}, MAP idp-two.test 127.0.0.1:${tlsPort}`,
        '--test-third-party-cookie-phaseout',
      ],
    })
    const version = await browser.version()
    assert(Number(version.match(/\/(\d+)/)?.[1]) >= 141, version)

    await using idpPage = new FedcmPage(await browser.newPage())
    await idpPage.goto(`${idpOrigin}/account/sign-in`)
    for (const name of ['alice', 'bob', 'carla']) {
      const response = await idpPage.api('/sign-in', {
        username: `${name}.test`,
        password: `${name}-pass`,
        remember: true,
        locale: 'en',
      })
      expect(response).toMatchObject({ status: 200 })
      expect(response.loginStatus).toBe('logged-in')
    }
    await idpPage.goto(`${idpOrigin}/account`)
    await idpPage.goto(`${otherOrigin}/account`)

    rpServer = createServer((req, res) => {
      if (req.url === '/cookie-probe') {
        res.setHeader('Content-Type', 'text/html')
        res.end(
          `<!doctype html><iframe src="${idpOrigin}/oauth/fedcm/cookie-probe"></iframe>`,
        )
      } else {
        oauthClientAssetsMiddleware(req, res)
      }
    })
    rpServer.listen(0, '127.0.0.1')
    await once(rpServer, 'listening')
    const rpPort = (rpServer.address() as AddressInfo).port
    const params = new URLSearchParams({
      env: 'test',
      plc_directory_url: network.plc.url,
      pds_operator_url: idpOrigin,
      handle_resolver: network.pds.url,
      scope: 'atproto',
    })
    params.append('fedcm_provider', configUrl)
    params.append('fedcm_provider', otherConfigUrl)
    appUrl = `http://127.0.0.1:${rpPort}/?${params}`
    requests.length = 0
  })

  afterAll(async () => {
    await browser?.close()
    await Promise.all(
      [tlsServer, rpServer]
        .filter(Boolean)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((err) => (err ? reject(err) : resolve())),
            ),
        ),
    )
    await network?.close()
    if (certDirectory) await rm(certDirectory, { recursive: true, force: true })
  })

  it('combines five accounts from two IdPs and dismisses without PAR', async () => {
    await using page = new FedcmPage(await browser.newPage())
    await page.goto(new URL('/cookie-probe', appUrl).href)
    await page.waitForNetworkIdle()
    const probe = requests.find((r) => r.path === '/oauth/fedcm/cookie-probe')
    expect(probe).toBeDefined()
    expect(probe?.cookie ?? '').not.toContain('fedcm-ses-id=')
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    expect(dialog.dialogType).toBe('AccountChooser')
    expect(dialog.accounts).toHaveLength(5)
    expect(
      dialog.accounts.filter((a) => a.idpConfigUrl === configUrl),
    ).toHaveLength(3)
    expect(
      dialog.accounts.filter((a) => a.idpConfigUrl === otherConfigUrl),
    ).toHaveLength(2)
    expect(parRequests()).toHaveLength(0)
    expect(
      requests.find((r) => r.path === '/oauth/fedcm/accounts')?.cookie,
    ).toContain('fedcm-ses-id=')
    await cdp.send('FedCm.dismissDialog', {
      dialogId: dialog.dialogId,
      triggerCooldown: false,
    })
    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')
    expect(parRequests()).toHaveLength(0)
  })

  it('selecting another provider causes no assertion or PAR at our PDS', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: dialog.accounts.findIndex(
        (a) => a.idpConfigUrl === otherConfigUrl,
      ),
    })
    await page.waitForNetworkIdle()
    expect(
      requests.some(
        (r) => r.host === 'idp-two.test' && r.path === '/assertion',
      ),
    ).toBe(true)
    expect(
      requests.filter((r) => r.path === '/oauth/fedcm/assertion'),
    ).toHaveLength(0)
    expect(parRequests()).toHaveLength(0)
    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')
  })

  it('cancels a FedCM handoff whose PAR response arrives after manual sign-in starts', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    await cdp.send('Network.enable')
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*/oauth/par', requestStage: 'Response' }],
    })
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    const firstResponse = nextParResponse(cdp)
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: dialog.accounts.findIndex((a) => a.accountId === dids[0]),
    })
    const first = await firstResponse
    const secondResponse = nextParResponse(cdp)
    const input = await page.typeInInput('identifier', dids[1])
    await input.press('Enter')
    const second = await secondResponse
    const completed = new Promise<void>((resolve) => {
      cdp.on('Network.loadingFinished', function finished(event) {
        if (event.requestId === first.networkId) {
          cdp.off('Network.loadingFinished', finished)
          resolve()
        }
      })
    })
    await cdp.send('Fetch.continueRequest', { requestId: first.requestId })
    await completed
    // @NOTE Give the canceled handoff a turn to process its completed PAR.
    await page.page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    )
    expect(new URL(page.page.url()).origin).toBe(new URL(appUrl).origin)
    expect(requests.filter((r) => r.path === '/oauth/authorize')).toHaveLength(
      0,
    )
    await cdp.send('Fetch.continueRequest', { requestId: second.requestId })
    await page.ensureTextVisibility('Authorize', 'button')
  })

  it('reports an OAuth subject that differs from the selected DID', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    await page.page.setRequestInterception(true)
    page.page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/oauth/par' &&
        request.method() === 'POST'
      ) {
        const input = new URLSearchParams(request.postData())
        input.set('login_hint', 'bob.test')
        void request.continue({ postData: input.toString() })
      } else {
        void request.continue()
      }
    })
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: dialog.accounts.findIndex((a) => a.accountId === dids[0]),
    })
    await page.navigationClick('Authorize')
    await page.ensureTextVisibility(
      `FedCM selected ${dids[0]}, but OAuth signed in as ${dids[1]}.`,
      'p',
    )
    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')
    expect(await page.page.$('h2::-p-text("Token info")')).toBeNull()
  })

  it('selecting our DID creates one ordinary OAuth PAR after selection', async () => {
    requests.length = 0
    await using page = new FedcmPage(await browser.newPage())
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    await page.goto(appUrl)
    const dialog = await shown
    expect(parRequests()).toHaveLength(0)
    await cdp.send('FedCm.selectAccount', {
      dialogId: dialog.dialogId,
      accountIndex: dialog.accounts.findIndex((a) => a.accountId === dids[0]),
    })
    await page.ensureTextVisibility('Authorize', 'button')
    // @NOTE A nonce challenge can retry the POST; only one PAR is created.
    expect(parRequests().filter((r) => r.status === 201)).toHaveLength(1)
    const assertionIndex = requests.findIndex(
      (r) => r.path === '/oauth/fedcm/assertion',
    )
    const parIndex = requests.findIndex((r) => r.path === '/oauth/par')
    expect(assertionIndex).toBeGreaterThanOrEqual(0)
    expect(parIndex).toBeGreaterThan(assertionIndex)
    await page.navigationClick('Authorize')
    await page.ensureTextVisibility('Token info', 'h2')
    expect(parRequests().filter((r) => r.status === 201)).toHaveLength(1)
  })

  it('keeps browser status logged in until the last remembered account signs out', async () => {
    await using page = new FedcmPage(await browser.newPage())
    await page.goto(`${idpOrigin}/account`)
    const first = await page.api('/sign-out', { did: dids[0] })
    expect(first.status).toBe(200)
    expect(first.loginStatus).toBe('logged-in')
    const last = await page.api('/sign-out', { did: dids.slice(1) })
    expect(last.status).toBe(200)
    expect(last.loginStatus).toBe('logged-out')
  })

  it('recovers a stale login status through the FedCM sign-in window', async () => {
    const context = await browser.createBrowserContext()
    await using _contextCleanup = {
      [Symbol.asyncDispose]: () => context.close(),
    }
    await using firstParty = new FedcmPage(await context.newPage())
    await firstParty.goto(`${idpOrigin}/account/sign-in`)
    // @NOTE Simulate Chrome retaining logged-in after its session expires.
    await firstParty.page.evaluate(async () => {
      await (
        navigator as Navigator & {
          login: { setStatus(status: string): Promise<void> }
        }
      ).login.setStatus('logged-in')
    })
    await firstParty.page.close()

    await using page = new FedcmPage(await context.newPage())
    const cdp = await page.cdp()
    const shown = nextDialog(cdp)
    const singleProviderUrl = new URL(appUrl)
    singleProviderUrl.searchParams.delete('fedcm_provider')
    singleProviderUrl.searchParams.append('fedcm_provider', configUrl)
    await page.goto(singleProviderUrl.href)
    const dialog = await shown
    expect(dialog.dialogType).toBe('ConfirmIdpLogin')
    const refreshed = nextDialog(cdp)
    void refreshed.catch(() => {})
    await using popup = await page.waitForPopup(() =>
      cdp.send('FedCm.clickDialogButton', {
        dialogId: dialog.dialogId,
        dialogButton: 'ConfirmIdpLoginContinue',
      }),
    )
    const popupTarget = await browser.waitForTarget(
      (target) => target.url() === `${idpOrigin}/account/sign-in?fedcm=true`,
    )
    const popupPage = await popupTarget.page()
    assert(popupPage)
    const closed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('FedCM sign-in window did not close')),
        5_000,
      )
      popupPage.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    void closed.catch(() => {})
    await popup.typeInInput('username', 'alice.test')
    await popup.typeInInput('password', 'alice-pass')
    await popup.clickOnText('Sign in')
    const chooser = await refreshed
    expect(chooser.dialogType).toBe('AccountChooser')
    expect(chooser.accounts.map((a) => a.accountId)).toEqual([dids[0]])
    await closed
    expect(popup.isClosed()).toBe(true)
    await cdp.send('FedCm.dismissDialog', {
      dialogId: chooser.dialogId,
      triggerCooldown: false,
    })
  })

  function parRequests() {
    return requests.filter(
      (r) => r.path === '/oauth/par' && r.method === 'POST',
    )
  }
})

class FedcmPage extends PageHelper {
  constructor(public override readonly page: Page) {
    super(page)
  }

  async cdp(): Promise<CDPSession> {
    const cdp = await this.page.createCDPSession()
    await cdp.send('FedCm.enable', { disableRejectionDelay: true })
    return cdp
  }

  async api(path: string, input: object) {
    return this.page.evaluate(
      async (path, input) => {
        const csrf = document.cookie
          .split('; ')
          .find((c) => c.startsWith('csrf-token='))
          ?.slice(11)
        const response = await fetch(`/@atproto/oauth-provider/~api${path}`, {
          method: 'POST',
          mode: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf ?? '',
          },
          body: JSON.stringify(input),
        })
        return {
          status: response.status,
          loginStatus: response.headers.get('Set-Login'),
          body: await response.json(),
        }
      },
      path,
      input,
    )
  }
}

function nextDialog(cdp: CDPSession): Promise<Dialog> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cdp.off('FedCm.dialogShown', onDialog)
      reject(new Error('Timed out waiting for FedCM dialog'))
    }, 10_000)
    function onDialog(dialog: Dialog) {
      clearTimeout(timeout)
      resolve(dialog)
    }
    cdp.once('FedCm.dialogShown', onDialog)
  })
}

function nextParResponse(
  cdp: CDPSession,
): Promise<{ requestId: string; networkId?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cdp.off('Fetch.requestPaused', onPaused)
      reject(new Error('Timed out waiting for successful PAR response'))
    }, 10_000)
    function onPaused(event: {
      requestId: string
      networkId?: string
      responseStatusCode?: number
    }) {
      if (event.responseStatusCode === 201) {
        clearTimeout(timeout)
        cdp.off('Fetch.requestPaused', onPaused)
        resolve(event)
      } else {
        void cdp
          .send('Fetch.continueRequest', { requestId: event.requestId })
          .catch(reject)
      }
    }
    cdp.on('Fetch.requestPaused', onPaused)
  })
}
