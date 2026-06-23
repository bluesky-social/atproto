import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { jest } from '@jest/globals'
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
      // slowMo: 25,
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

    await page.assertTitle('OAuth Client Example')

    await page.navigationClick(`Sign up with ${new URL(network.pds.url).host}`)

    await page.assertTitle('Inscription')

    await page.typeInInput('handle', 'bob')

    await page.clickOnText('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnText('Inscription')

    await page.ensureTextVisibility(
      `L'application demande un contrôle total sur votre identité, ce qui signifie qu'elle pourrait casser de façon permanente, ou même usurper, votre compte. N'autorisez l'accès qu'aux applications auxquelles vous faites vraiment confiance.`,
    )

    // Make sure the new account is propagated to the PLC directory, allowing
    // the client to resolve the account's did
    await network.processAll()

    await page.navigationClick('Autoriser')

    await page.assertTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })

  it('Allows canceling the OAuth flow', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.assertTitle('OAuth Client Example')

    await page.navigationClick(`Login with ${new URL(network.pds.url).host}`)

    await page.assertTitle('Se connecter')

    // Cancel the OAuth flow:
    await page.navigationClick('Annuler')

    await page.assertTitle('OAuth Client Example')

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

    await page.assertTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.assertTitle('Connexion')

    await page.clickOnText('Oublié ?')

    await page.assertTitle('Mot de passe oublié')

    await page.typeInInput('email', 'alice@test.com')

    expect(sendTemplateMock).toHaveBeenCalledTimes(0)

    await page.clickOnText('Suivant')

    await page.assertTitle('Réinitialiser le mot de passe')

    expect(sendTemplateMock).toHaveBeenCalledTimes(1)

    const [params] = sendTemplateMock.mock.lastCall!
    expect(params).toEqual({
      handle: 'alice.test',
      locale: 'fr',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)

    await page.typeInInput('password', 'alice-new-pass')

    await page.clickOnText('Suivant')

    await page.assertTitle('Mot de passe mis à jour')

    await page.ensureTextVisibility('Mot de passe mis à jour !', 'h2')

    sendTemplateMock.mockRestore()
  })

  it('Allows to sign-in through OAuth', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.assertTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.assertTitle('Connexion')

    await page.typeInInput('password', 'alice-new-pass')

    // Make sure the warning is visible
    await page.ensureTextVisibility('Avertissement', 'h3')

    await page.clickOn(
      'label::-p-text(Se souvenir de ce compte sur cet appareil)',
    )

    await page.clickOnText('Se connecter')

    await page.assertTitle('Autoriser')

    await page.navigationClick('Autoriser')

    await page.assertTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })

  it('remembers the session', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(appUrl)

    await page.assertTitle('OAuth Client Example')

    const input = await page.typeInInput('identifier', 'alice.test')

    await page.navigationAction(async () => input.press('Enter'))

    await page.assertTitle('Autoriser')

    await page.navigationClick('Autoriser')

    await page.assertTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })

  it('revokes OAuth sessions on deactivation & requires re-activation on sign-in', async () => {
    await using page = await PageHelper.from(browser, { languages })

    // Sign into the client (the device session is remembered, so the flow
    // jumps straight to the consent screen).
    await page.goto(appUrl)

    await page.assertTitle('OAuth Client Example')

    await page.navigationAction(async () => {
      const input = await page.typeInInput('identifier', 'alice.test')
      await input.press('Enter')
    })

    await page.assertTitle('Autoriser')

    await page.navigationClick('Autoriser')

    await page.assertTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    // While the client page is still open, deactivate the account through
    // the account manager in another page.
    {
      await using accountPage = await PageHelper.from(browser, { languages })

      await accountPage.goto(new URL('/account', network.pds.url))

      await accountPage.assertTitle('Mon compte Atmosphère')

      await accountPage.clickOnText('Compte utilisateur', 'a')

      await accountPage.clickOnText('Désactiver le compte')

      await accountPage.clickOnText('Oui, désactiver')

      await accountPage.waitForNetworkIdle()

      await accountPage.ensureTextVisibility('Réactiver le compte', 'span')

      await network.processAll()
    }

    // Back in the client: deactivation revoked every OAuth session, so
    // refreshing the credentials logs the user out.
    await page.clickOnText('refresh').catch((_err) => {
      // The OAuth app may have refreshed the session on it's own, causing the
      // page to reset before the click is processed, which throws an error.
    })

    await page.waitForNetworkIdle()

    await page.ensureTextVisibility('Login with the Atmosphere', 'h2')

    // Signing back in with the deactivated account asks the user to
    // re-activate it before the flow can proceed.
    // @NOTE The PDS is used directly as issuer (rather than resolving the
    // handle) because handle resolution does not work for deactivated
    // accounts.

    await page.navigationClick(`Login with ${new URL(network.pds.url).host}`)

    await page.ensureTextVisibility('Se connecter en tant que...')

    await page.clickOnText('alice.test', 'span')

    await page.assertTitle('Heureux de vous revoir!')

    await page.ensureTextVisibility('Vous avez précédemment désactivé')

    await page.clickOnText('Oui, réactiver mon compte')

    // Deactivation also cleared the authorized clients, so consent is
    // required again.
    await page.assertTitle('Autoriser')

    await page.navigationClick('Autoriser')

    await page.assertTitle('OAuth Client Example')

    await page.ensureTextVisibility('Token info', 'h2')

    await page.clickOnAriaLabel('User menu')

    await page.clickOnText('Sign out')

    await page.waitForNetworkIdle()
  })
})
