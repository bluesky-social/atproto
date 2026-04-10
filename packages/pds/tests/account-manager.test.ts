import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { type Browser, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { oauthClientAssetsMiddleware } from './_oauth_client_assets_middleware.js'
import { PageHelper } from './_puppeteer.js'

describe('oauth', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let server: Server

  let appUrl: string

  // @NOTE We are using another language than "en" as default language to
  // test the language negotiation.
  const languages = ['fr-BE', 'fr', 'en-US', 'en']

  beforeAll(async () => {
    browser = await launch({
      browser: 'chrome', // "firefox"

      // For debugging:
      headless: false,
      devtools: true,
      slowMo: 150,
    })

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account-manager',
    })

    const sc = network.getSeedClient()

    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })

    server = createServer(oauthClientAssetsMiddleware)
    server.listen(0)
    await once(server, 'listening')

    const { port } = server.address() as AddressInfo

    appUrl = `http://127.0.0.1:${port}?${new URLSearchParams({
      plc_directory_url: network.plc.url,
      handle_resolver: network.pds.url,
      sign_up_url: network.pds.url,
      env: 'test',
      scope: `account:email identity:* repo:*`,
    })}`

    appUrl
  })

  afterAll(async () => {
    await server?.close()
    await network?.close()
    await browser?.close()
  })

  it.only('allows creating an account', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.checkTitle(`S'identifier`)

    await page.clickOnText('Créer un nouveau compte')

    await page.typeInInput('handle', 'bob')

    await page.clickOnText('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnText("S'inscrire")

    await page.checkTitle(`Mon compte`)

    await page.ensureTextVisibility('bob.test', 'span')
    await page.ensureTextVisibility('Votre compte Atmosphere est hébergé par')
  })

  it('allows switching accounts', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.checkTitle(`Mon compte`)

    await page.clickOnAriaLabel(`Sélecteur de compte`)
    await page.clickOnText('Sélectionner un autre compte')
    await page.clickOnText('Un autre compte', '*')

    await page.typeInInput('username', 'alice.test')
    const input = await page.typeInInput('password', 'alice-pass')

    input.press('Enter')

    await page.ensureTextVisibility('alice.test')

    await page.clickOnAriaLabel(`Sélecteur de compte`)
    await page.clickOnText('Sélectionner un autre compte')

    await page.ensureTextVisibility('alice.test')
    await page.ensureTextVisibility('bob.test')
  })

  // @TODO Sing-up should not create a "remember me" account
  it('forgot about the ephemeral session when loading the page again', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.checkTitle(`Mon compte`)

    await page.ensureTextVisibility('bob.test')

    await page.ensureTextVisibility('alice.test').then(
      () => {
        throw new Error('Should not be visible')
      },
      (err) => {
        console.error('Expected error', err)
        expect(err).toBeInstanceOf(Error)
      },
    )
  })
})
