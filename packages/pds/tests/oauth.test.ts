import assert from 'node:assert'
import { TestNetworkNoAppView } from '@atproto/dev-env'
// @ts-expect-error (json file)
import files from '@atproto/oauth-client-browser-example'
import { Browser, launch, Page } from 'puppeteer'
import { once } from 'node:events'
import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'

const getVisibleElement = async (page: Page, selector: string) => {
  const elementHandle = await page.waitForSelector(selector)

  expect(elementHandle).not.toBeNull()
  assert(elementHandle)

  await expect(elementHandle.isVisible()).resolves.toBe(true)

  return elementHandle
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
      env: 'test',
    })}`
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

    const handleInput = await getVisibleElement(
      page,
      'input[placeholder="@handle, DID or PDS url"]',
    )

    await handleInput.focus()

    await handleInput.type('alice.test')

    await Promise.all([
      //
      handleInput.press('Enter'),
      page.waitForNavigation(),
    ])

    await expect(page.title()).resolves.toBe('Authorize')

    const passwordInput = await getVisibleElement(
      page,
      'input[type="password"]',
    )

    await passwordInput.focus()

    // Make sure the warning is visible
    await getVisibleElement(page, 'p::-p-text(Warning)')

    await passwordInput.type('alice-pass')

    const rememberCheckbox = await getVisibleElement(
      page,
      'label::-p-text(Remember this account on this device)',
    )

    await rememberCheckbox.click()

    const nextButton = await getVisibleElement(page, 'button::-p-text(Next)')

    await nextButton.click()

    const acceptButton = await getVisibleElement(
      page,
      'button::-p-text(Accept)',
    )

    await Promise.all([
      //
      acceptButton.click(),
      page.waitForNavigation(),
    ])

    await expect(page.title()).resolves.toBe('OAuth Client Example')

    // Check that the "Logged in!" message is visible
    await getVisibleElement(page, 'p::-p-text(Logged in!)')
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
