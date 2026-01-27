import { once } from 'node:events'
import {
  IncomingMessage,
  Server,
  ServerResponse,
  createServer,
} from 'node:http'
import { AddressInfo } from 'node:net'
import { type Browser, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import files from '@atproto/oauth-client-browser-example' with { type: 'json' }
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

    server = createServer(clientHandler)
    server.listen(0)
    await once(server, 'listening')

    const { port } = server.address() as AddressInfo

    appUrl = `http://127.0.0.1:${port}?${new URLSearchParams({
      plc_directory_url: network.plc.url,
      handle_resolver: network.pds.url,
      sign_up_url: network.pds.url,
      env: 'test',
      scope: `atproto account:email identity:* repo:* rpc:app.bsky.actor.getPreferences?aud=*`,
    })}`
  })

  afterAll(async () => {
    await server?.close()
    await network?.close()
    await browser?.close()
  })

  // This uses prompt=create under the hood:
  it('Allows to sign-up through OAuth', async () => {
    const page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      await page.clickOnButton(`Sign up with ${new URL(network.pds.url).host}`)
    })

    await page.checkTitle('Créer un compte')

    await page.typeInInput('handle', 'bob')

    await page.clickOnButton('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnButton("S'inscrire")

    await page.ensureTextVisibility(
      `L'application demande un contrôle total sur votre identité, ce qui signifie qu'elle pourrait casser de façon permanente, ou même usurper, votre compte. N'authorisez l'accès qu'aux applications auxquelles vous faites vraiment confiance.`,
    )

    // Make sure the new account is propagated to the PLC directory, allowing
    // the client to resolve the account's did
    await network.processAll()

    await page.navigationAction(async () => {
      await page.clickOnButton("Authoriser l'accès")
    })

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOn('button[aria-label="User menu"]')

    await page.clickOnButton('Sign out')

    await page.waitForNetworkIdle()

    // TODO: Find out why we can't use "using" here
    await page[Symbol.asyncDispose]()
  })

  it('Allows login or signup through OAuth via a choice', async () => {
    const page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      await page.clickOnButton(`Login with ${new URL(network.pds.url).host}`)
    })

    await page.checkTitle('Authentification')

    await page.ensureTextVisibility('Annuler', 'button')
    await page.ensureTextVisibility('Se connecter', 'button')
    await page.ensureTextVisibility('Créer un nouveau compte', 'button')

    // Cancel the OAuth flow:
    await page.navigationAction(async () => {
      await page.clickOnButton('Annuler')
    })

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')

    await page.waitForNetworkIdle()

    // TODO: Find out why we can't use "using" here
    await page[Symbol.asyncDispose]()
  })

  it('allows resetting the password', async () => {
    const sendTemplateMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
      .mockImplementation(async () => {
        // noop
      })

    const page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      const input = await page.typeIn('input[name="identifier"]', 'alice.test')

      await input.press('Enter')
    })

    await page.checkTitle('Connexion')

    await page.clickOnButton('Oublié ?')

    await page.checkTitle('Mot de passe oublié')

    await page.typeInInput('email', 'alice@test.com')

    expect(sendTemplateMock).toHaveBeenCalledTimes(0)

    await page.clickOnButton('Suivant')

    await page.checkTitle('Réinitialiser le mot de passe')

    expect(sendTemplateMock).toHaveBeenCalledTimes(1)

    const [params] = sendTemplateMock.mock.lastCall
    expect(params).toEqual({
      handle: 'alice.test',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)

    await page.typeInInput('password', 'alice-new-pass')

    await page.clickOnButton('Suivant')

    await page.checkTitle('Mot de passe mis à jour')

    await page.ensureTextVisibility('Mot de passe mis à jour !', 'h2')

    // TODO: Find out why we can't use "using" here
    await page[Symbol.asyncDispose]()

    sendTemplateMock.mockRestore()
  })

  it('Allows to sign-in through OAuth', async () => {
    const page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      const input = await page.typeIn('input[name="identifier"]', 'alice.test')

      await input.press('Enter')
    })

    await page.checkTitle('Connexion')

    await page.typeIn('input[type="password"]', 'alice-new-pass')

    // Make sure the warning is visible
    await page.ensureTextVisibility('Avertissement', 'h3')

    await page.clickOn(
      'label::-p-text(Se souvenir de ce compte sur cet appareil)',
    )

    await page.clickOnButton('Se connecter')

    await page.checkTitle("Authoriser l'accès")

    await page.navigationAction(async () => {
      await page.clickOnButton("Authoriser l'accès")
    })

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOn('button[aria-label="User menu"]')

    await page.clickOnButton('Sign out')

    await page.waitForNetworkIdle()

    // TODO: Find out why we can't use "using" here
    await page[Symbol.asyncDispose]()
  })

  it('remembers the session', async () => {
    const page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      const input = await page.typeIn('input[name="identifier"]', 'alice.test')

      await input.press('Enter')
    })

    await page.checkTitle("Authoriser l'accès")

    await page.navigationAction(async () => {
      await page.clickOnButton("Authoriser l'accès")
    })

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOn('button[aria-label="User menu"]')

    await page.clickOnButton('Sign out')

    await page.waitForNetworkIdle()

    // TODO: Find out why we can't use "using" here
    await page[Symbol.asyncDispose]()
  })
})

function clientHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
): void {
  const path = req.url?.split('?')[0].slice(1) || 'index.html'
  const file = Object.hasOwn(files, path) ? files[path] : null

  if (file) {
    res
      .writeHead(200, 'OK', { 'content-type': file.mime })
      .end(Buffer.from(file.data, 'base64'))
  } else if (next) {
    next()
  } else {
    res
      .writeHead(404, 'Not Found', { 'content-type': 'text/plain' })
      .end('Page not found')
  }
}
