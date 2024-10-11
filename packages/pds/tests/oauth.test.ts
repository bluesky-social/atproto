import assert from 'node:assert'
import { TestNetworkNoAppView } from '@atproto/dev-env'
// @ts-expect-error (json file)
import files from '@atproto/oauth-client-browser-example'
import { Browser, launch } from 'puppeteer'
import { once } from 'node:events'
import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'

describe('oauth', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let server: Server

  let appUrl: string

  beforeAll(async () => {
    browser = await launch({
      browser: 'chrome',

      // For debugging:
      headless: false,
      devtools: true,
      slowMo: 250,
    })

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'oauth',
    })

    const sc = network.getSeedClient()

    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })

    server = await createClientServer()

    appUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}?plc_directory_url=${network.plc.url}&handle_resolver=${network.pds.url}`
  })

  afterAll(async () => {
    await server?.close()
    await network?.close()
    await browser?.close()
  })

  it('starts', async () => {
    const page = await browser.newPage()

    await page.goto(appUrl)

    await expect(page.title()).resolves.toBe('OAuth Client Example')

    const handleInput = await page.waitForSelector(
      'input[placeholder="@handle, DID or PDS url"]',
    )

    expect(handleInput).not.toBeNull()
    assert(handleInput)

    await handleInput.focus()

    await handleInput.type('alice.test')

    const navToAuthorize = page.waitForNavigation()

    await handleInput.press('Enter')

    await navToAuthorize

    await expect(page.title()).resolves.toBe('Authorize')

    const passwordInput = await page.waitForSelector('input[type="password"]')

    expect(passwordInput).not.toBeNull()
    assert(passwordInput)

    await passwordInput.focus()

    await passwordInput.type('alice-pass')

    await passwordInput.press('Enter')

    const acceptButton = await page.waitForSelector('button::-p-text(Accept)')

    expect(acceptButton).not.toBeNull()
    assert(acceptButton)

    const navBackToApp = page.waitForNavigation()

    await acceptButton.click()

    await navBackToApp

    await expect(page.title()).resolves.toBe('OAuth Client Example')

    const loggedIn = await page.waitForSelector('p::-p-text(Logged in!)')

    expect(loggedIn).not.toBeNull()
    assert(loggedIn)
  })
})

async function createClientServer() {
  const server = createServer((req, res) => {
    const path = req.url?.split('?')[0].slice(1) || 'index.html'
    const file = Object.hasOwn(files, path) ? files[path] : null

    if (file) {
      res
        .writeHead(200, 'OK', { 'content-type': file.type })
        .end(Buffer.from(file.data, 'base64'))
    } else {
      res
        .writeHead(404, 'Not Found', { 'content-type': 'text/plain' })
        .end('Page not found')
    }
  })

  server.listen(0)
  await once(server, 'listening')

  return server
}
