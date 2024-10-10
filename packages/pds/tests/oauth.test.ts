import { TestNetworkNoAppView } from '@atproto/dev-env'
// @ts-expect-error (json file)
import files from '@atproto/oauth-client-browser-example'
import {
  Browser,
  BrowserErrorCaptureEnum,
  BrowserNavigationCrossOriginPolicyEnum,
} from 'happy-dom'
import { once } from 'node:events'
import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'

describe('oauth', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let server: Server

  let appUrl: string

  beforeAll(async () => {
    browser = new Browser({
      settings: {
        errorCapture: BrowserErrorCaptureEnum.disabled,
        navigation: {
          crossOriginPolicy: BrowserNavigationCrossOriginPolicyEnum.anyOrigin,
        },
      },
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
    const page = browser.newPage()
    try {
      console.log('appUrl', appUrl)

      await page.goto(appUrl)

      const title = page.mainFrame.document.title

      expect(title).toBe('OAuth Client Example')
    } finally {
      await page.close()
    }
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
