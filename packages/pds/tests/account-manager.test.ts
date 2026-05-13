import { type Browser, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { PageHelper } from './_puppeteer.js'

describe('account manager', () => {
  let browser: Browser
  let network: TestNetworkNoAppView

  // @NOTE We are using another language than "en" as default language to
  // test the language negotiation.
  const languages = ['fr-BE', 'fr', 'en-US', 'en']

  beforeAll(async () => {
    browser = await launch({
      browser: 'chrome', // "firefox"

      // For debugging:
      // headless: false,
      // devtools: true,
      // slowMo: 150,
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
  })

  afterAll(async () => {
    await network?.close()
    await browser?.close()
  })

  it('allows creating an account', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle(`S'identifier`)

    await page.clickOnText('Créer un nouveau compte')

    await page.typeInInput('handle', 'bob')

    await page.clickOnText('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnText("S'inscrire")

    await page.assertTitle(`Compte utilisateur`)

    await page.ensureTextVisibility('bob.test', 'span')
    await page.ensureTextVisibility('Votre compte Atmosphère est hébergé chez')
  })

  it('allows switching accounts', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle(`Compte utilisateur`)

    await page.clickOnAriaLabel(`Sélecteur de compte`)
    await page.clickOnText('Sélectionner un autre compte')
    await page.clickOnText('Un autre compte', '*')

    await page.typeInInput('username', 'alice.test')
    const input = await page.typeInInput('password', 'alice-pass')

    input.press('Enter')

    await page.ensureTextVisibility('alice.test', 'span')

    await page.clickOnAriaLabel(`Sélecteur de compte`)
    await page.clickOnText('Sélectionner un autre compte')

    await page.ensureTextVisibility('alice.test', 'span')
    await page.ensureTextVisibility('bob.test', 'span')
  })

  it('forgot about the ephemeral session when loading the page again', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle(`Compte utilisateur`)

    await page.ensureTextVisibility('bob.test', 'span')

    await page.ensureTextVisibility('alice.test', 'span').then(
      () => {
        throw new Error('Should not be visible')
      },
      (err) => {
        expect(err).toBeInstanceOf(Error)
      },
    )
  })

  it('allows changing the password', async () => {
    const sendResetPasswordMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
      .mockImplementation(async () => {
        // noop
      })

    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle(`Compte utilisateur`)

    await page.clickOnText('Mot de passe', 'a')

    expect(sendResetPasswordMock).toHaveBeenCalledTimes(0)

    await page.clickOnText('Envoyer le code')

    await page.waitForNetworkIdle()

    expect(sendResetPasswordMock).toHaveBeenCalledTimes(1)

    const [params] = sendResetPasswordMock.mock.lastCall
    expect(params).toEqual({
      handle: 'bob.test',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)
    await page.typeInInput('password', 'bob-new-pass')

    await page.clickOnText('Soumettre')

    await page.ensureTextVisibility(
      'Réinitialisation du mot de passe réussie',
      'div',
    )

    sendResetPasswordMock.mockRestore()
  })
})
