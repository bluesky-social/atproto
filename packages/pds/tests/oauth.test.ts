import assert from 'node:assert'
import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { type Browser, type Page, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
// @ts-expect-error (json file)
import files from '@atproto/oauth-client-browser-example'

class PageHelper implements AsyncDisposable {
  constructor(protected readonly page: Page) {}

  async goto(url: string) {
    await this.page.goto(url)
  }

  async navigateAfter(run: () => Promise<unknown>): Promise<void> {
    const promise = this.page.waitForNavigation()
    await run()
    await promise
  }

  async ensureVisibility(selector: string) {
    await this.getVisibleElement(selector)
  }

  async checkTitle(expected: string) {
    await expect(this.page.title()).resolves.toBe(expected)
  }

  async clickOn(selector: string) {
    const elementHandle = await this.getVisibleElement(selector)
    await elementHandle.click()
    return elementHandle
  }

  async typeIn(selector: string, text: string) {
    const elementHandle = await this.getVisibleElement(selector)
    elementHandle.focus()
    await elementHandle.type(text)
    return elementHandle
  }

  protected async getVisibleElement(selector: string) {
    const elementHandle = await this.page.waitForSelector(selector)

    expect(elementHandle).not.toBeNull()
    assert(elementHandle)

    await expect(elementHandle.isVisible()).resolves.toBe(true)

    return elementHandle
  }

  [Symbol.asyncDispose]() {
    return this.page.close()
  }

  static async from(browser: Browser) {
    return new PageHelper(await browser.newPage())
  }
}

describe('oauth', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let server: Server

  let appUrl: string

  beforeAll(async () => {
    browser = await launch({
      browser: 'chrome',

      // For debugging:
      // headless: false,
      // devtools: true,
      // slowMo: 250,
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

    const { port } = server.address() as AddressInfo

    appUrl = `http://127.0.0.1:${port}?${new URLSearchParams({
      plc_directory_url: network.plc.url,
      handle_resolver: network.pds.url,
      sign_up_url: network.pds.url,
      env: 'test',
    })}`
  })

  afterAll(async () => {
    await server?.close()
    await network?.close()
    await browser?.close()
  })

  it('Allows to sign-up trough OAuth', async () => {
    const page = await PageHelper.from(browser)

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigateAfter(() => page.clickOn('button::-p-text(Sign up)'))

    await page.checkTitle('Authenticate')

    await page.clickOn('button::-p-text(Create a new account)')

    await page.typeIn('input[placeholder="Type your desired username"]', 'bob')

    await page.clickOn('button::-p-text(Next)')

    await page.typeIn('input[placeholder="Email"]', 'bob@test.com')

    await page.typeIn('input[placeholder="Enter a password"]', 'bob-pass')

    await page.typeIn('input[type="date"]', '01/01/1999')

    await page.clickOn('button::-p-text(Sign up)')

    // Make sure the new account is propagated to the PLC directory, allowing
    // the client to resolve the account's did
    await network.processAll()

    await page.navigateAfter(() => page.clickOn('button::-p-text(Accept)'))

    await page.checkTitle('OAuth Client Example')

    await page.ensureVisibility('p::-p-text(Logged in!)')

    await page.clickOn('button::-p-text(Sign-out)')
  })

  it('Allows to sign-in trough OAuth', async () => {
    const page = await PageHelper.from(browser)

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigateAfter(async () => {
      const input = await page.typeIn(
        'input[placeholder="@handle, DID or PDS url"]',
        'alice.test',
      )

      await input.press('Enter')
    })

    await page.checkTitle('Sign in')

    await page.typeIn('input[type="password"]', 'alice-pass')

    // Make sure the warning is visible
    await page.ensureVisibility('p::-p-text(Warning)')

    await page.clickOn('label::-p-text(Remember this account on this device)')

    await page.clickOn('button::-p-text(Submit)')

    await page.navigateAfter(() => page.clickOn('button::-p-text(Accept)'))

    await page.checkTitle('OAuth Client Example')

    await page.ensureVisibility('p::-p-text(Logged in!)')

    await page.clickOn('button::-p-text(Sign-out)')
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
