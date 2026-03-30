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
  })

  afterAll(async () => {
    await server?.close()
    await network?.close()
    await browser?.close()
  })

  // This uses prompt=create under the hood:
  it('Allows to sign-up through OAuth', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationButtonClick(
      `Sign up with ${new URL(network.pds.url).host}`,
    )

    await page.checkTitle("S'inscrire")

    await page.typeInInput('handle', 'bob')

    await page.clickOnText('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnText("S'inscrire")

    await page.ensureTextVisibility(
      `L'application demande un contrôle total sur votre identité, ce qui signifie qu'elle pourrait casser de façon permanente, ou même usurper, votre compte. N'authorisez l'accès qu'aux applications auxquelles vous faites vraiment confiance.`,
    )

    // Make sure the new account is propagated to the PLC directory, allowing
    // the client to resolve the account's did
    await network.processAll()

    await page.navigationButtonClick('Autoriser')

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })

  it('Allows login or signup through OAuth via a choice', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    await page.navigationButtonClick(
      `Login with ${new URL(network.pds.url).host}`,
    )

    await page.checkTitle("S'identifier")

    await page.ensureTextVisibility('Annuler', 'button')
    await page.ensureTextVisibility('Se connecter', 'button')
    await page.ensureTextVisibility('Créer un nouveau compte', 'button')

    // Cancel the OAuth flow:
    await page.navigationButtonClick('Annuler')

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')

    await page.waitForNetworkIdle()
  })

  it('allows resetting the password', async () => {
    const sendTemplateMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
      .mockImplementation(async () => {
        // noop
      })

    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.checkTitle('Connexion')

    await page.clickOnText('Oublié ?')

    await page.checkTitle('Mot de passe oublié')

    await page.typeInInput('email', 'alice@test.com')

    expect(sendTemplateMock).toHaveBeenCalledTimes(0)

    await page.clickOnText('Suivant')

    await page.checkTitle('Réinitialiser le mot de passe')

    expect(sendTemplateMock).toHaveBeenCalledTimes(1)

    const [params] = sendTemplateMock.mock.lastCall
    expect(params).toEqual({
      handle: 'alice.test',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)

    await page.typeInInput('password', 'alice-new-pass')

    await page.clickOnText('Suivant')

    await page.checkTitle('Mot de passe mis à jour')

    await page.ensureTextVisibility('Mot de passe mis à jour !', 'h2')

    sendTemplateMock.mockRestore()
  })

  it('Allows to sign-in through OAuth', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.checkTitle('Connexion')

    await page.typeInInput('password', 'alice-new-pass')

    // Make sure the warning is visible
    await page.ensureTextVisibility('Avertissement', 'h3')

    await page.clickOn(
      'label::-p-text(Se souvenir de ce compte sur cet appareil)',
    )

    await page.clickOnText('Se connecter')

    await page.checkTitle('Autoriser')

    await page.navigationButtonClick('Autoriser')

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })

  it('remembers the session', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.checkTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.checkTitle('Autoriser')

    await page.navigationButtonClick('Autoriser')

    await page.checkTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })
})
