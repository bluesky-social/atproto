import { jest } from '@jest/globals'
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
      // slowMo: 25,
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

  afterEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
    await browser?.close()
  })

  it('allows creating an account', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle(`Se connecter`)

    await page.clickOnText('Créer un nouveau compte')

    await page.typeInInput('handle', 'bob')

    await page.clickOnText('Suivant')

    await page.typeInInput('email', 'bob@test.com')
    await page.typeInInput('password', 'bob-pass')

    await page.clickOnText('Inscription')

    await page.waitForNetworkIdle()

    await page.ensureTextVisibility('bob.test', 'span')
    await page.ensureTextVisibility('Votre compte Atmosphère est hébergé chez')

    await page.assertTitle('Mon compte Atmosphère')
  })

  it('allows switching accounts', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

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

    await page.assertTitle('Mon compte Atmosphère')

    await page.ensureTextVisibility('bob.test', 'span')

    await expect(async () => {
      await page.ensureTextVisibility('alice.test', 'span', 500)
    }).rejects.toThrow('Waiting for selector')
  })

  it('allows changing the password', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText('Mot de passe')

    using sendResetPasswordMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
      .mockImplementation(async () => {
        // noop
      })

    await page.clickOnText('Envoyer le code de vérification')

    await page.waitForNetworkIdle()

    expect(sendResetPasswordMock).toHaveBeenCalledTimes(1)

    const [params] = sendResetPasswordMock.mock.lastCall!
    expect(params).toEqual({
      handle: 'bob.test',
      locale: 'fr',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)
    await page.typeInInput('password', 'bob-new-pass')

    await page.clickOnText('Valider')

    await page.ensureNotification('Réinitialisation du mot de passe réussie')
  })

  it('allows verifying the email address', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.ensureTextVisibility('Votre adresse email doit être vérifiée.')

    await page.clickOnText('Vérifier')

    using sendConfirmEmailMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendConfirmEmail')
      .mockImplementation(async () => {
        // noop
      })

    await page.clickOnText('Envoyer le code de vérification', 'button')

    await page.waitForNetworkIdle()

    expect(sendConfirmEmailMock).toHaveBeenCalledTimes(1)

    const [params] = sendConfirmEmailMock.mock.lastCall!
    expect(params).toEqual({
      locale: 'fr',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)
    await page.clickOnText('Valider')

    await page.ensureNotification('Adresse email vérifiée')
  })

  it('allows changing the username', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText("Nom d'utilisateur")

    await page.clickOnText("Utiliser un nom d'utilisateur par défaut")

    await page.typeInInput('handle', 'bob-renamed')

    await page.clickOnText('Valider')

    await page.waitForNetworkIdle()

    await page.ensureTextVisibility('bob-renamed.test', 'span')
  })

  it('allows changing the email address', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText('Adresse email')

    using sendUpdateEmailMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendUpdateEmail')
      .mockImplementation(async () => {
        // noop
      })

    const emailInput = await page.typeInInput(
      'email',
      'bob-new-email@example.com',
    )
    emailInput.press('Enter')

    await page.waitForNetworkIdle()

    expect(sendUpdateEmailMock).toHaveBeenCalledTimes(1)

    const [updateParams] = sendUpdateEmailMock.mock.lastCall!
    expect(updateParams).toEqual({
      locale: 'fr',
      token: expect.any(String),
    })

    const codeInput = await page.typeInInput('code', updateParams.token)
    codeInput.press('Enter')

    await page.ensureNotification("Modification de l'adresse email réussie")

    // The email needs to be verified again
    await page.ensureTextVisibility('Votre adresse email doit être vérifiée.')
  })

  it('allows signing out & signing back in', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnAriaLabel(`Sélecteur de compte`)
    await page.clickOnText('Se déconnecter')

    await page.assertTitle(`Se connecter`)
    await page.clickOnText('Se connecter')

    await page.clickOnText('Se souvenir de ce compte sur cet appareil', 'label')
    await page.typeInInput('username', 'bob-new-email@example.com')
    const input = await page.typeInInput('password', 'bob-new-pass')

    input.press('Enter')

    await page.ensureTextVisibility('bob-renamed.test', 'span')
  })

  it('does not ask for a token when changing a non-verified email', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText('Adresse email')

    using sendUpdateEmailMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendUpdateEmail')
      .mockImplementation(async () => {
        // noop
      })

    const emailInput = await page.typeInInput(
      'email',
      'bob-new-email@example.com',
    )
    emailInput.press('Enter')

    await page.waitForNetworkIdle()

    expect(sendUpdateEmailMock).not.toHaveBeenCalled()

    await page.clickOnText('Plus tard')

    await page.ensureNotification("Modification de l'adresse email réussie")

    // The email needs to be verified again
    await page.ensureTextVisibility('Votre adresse email doit être vérifiée.')
  })

  it('rejects racial slurs when changing username', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText("Nom d'utilisateur")

    await page.clickOnText("Utiliser un nom d'utilisateur par défaut")

    // Try to change username to a racial slur
    await page.typeInInput('handle', 'nigger')

    await page.clickOnText('Valider')

    await page.waitForNetworkIdle()

    // Should display appropriate error message
    await page.ensureTextVisibility(
      "Le nom d'utilisateur contient un langage inapproprié",
    )

    // Username should not have changed
    await page.clickOnText('Retour')
    await page.ensureTextVisibility('bob-renamed.test', 'span')
  })

  it('rejects custom domain when not configured', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText("Nom d'utilisateur")

    await page.clickOnText('Utiliser un nom de domaine que je possède')

    // DNS is the default verification method
    await page.ensureTextVisibility(
      'Ajoutez le champ suivant à la configuration DNS de votre domaine.',
    )
    await page.ensureTextVisibility('_atproto.<votre-domaine>', 'code')
    await page.ensureTextVisibility('TXT', 'code')

    // Switch to HTTP verification method
    await page.clickOnText('HTTP', 'span')

    await page.ensureTextVisibility(
      "Rendez un fichier texte avec le contenu ci-dessous disponible à l'URL suivante.",
    )
    await page.ensureTextVisibility(
      'https://<votre-domaine>/.well-known/atproto-did',
      'code',
    )

    // Try to use an unconfigured domain
    await page.typeInInput('domain', 'notconfigured.com')

    await page.clickOnText('Vérifier et enregistrer')

    await page.waitForNetworkIdle()

    // Should display appropriate error message
    await page.ensureTextVisibility(
      "Le nom d'utilisateur n'a pas pu être résolu",
    )

    // Username should not have changed
    await page.clickOnText('Retour')
    await page.ensureTextVisibility('bob-renamed.test', 'span')
  })

  it('allows deactivating & reactivating the account', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText('Désactiver le compte')

    await page.ensureTextVisibility(
      'limite de temps pour la désactivation du compte',
    )

    await page.clickOnText('Oui, désactiver')

    await page.waitForNetworkIdle()

    // The row should now offer re-activation
    await page.ensureTextVisibility('Réactiver le compte', 'span')

    await page.clickOnText('Réactiver le compte')

    // @NOTE The dialog's submit label ("Réactiver") is a substring of the
    // trigger row ("Réactiver le compte"), which comes first in DOM order, so
    // we target the dialog's submit button instead of using its text.
    await page.clickOn('[role="dialog"] button[type="submit"]')

    await page.waitForNetworkIdle()

    await page.ensureTextVisibility('Désactiver le compte', 'span')
  })

  it('allows deleting the account', async () => {
    await using page = await PageHelper.from(browser, { languages })

    await page.goto(new URL('/account', network.pds.url))

    await page.assertTitle('Mon compte Atmosphère')

    await page.clickOnText('Compte utilisateur', 'a')

    await page.clickOnText('Supprimer le compte')

    using sendAccountDeleteMock = jest
      .spyOn(network.pds.ctx.mailer, 'sendAccountDelete')
      .mockImplementation(async () => {
        // noop
      })

    await page.clickOnText("Envoyer l'email")

    await page.waitForNetworkIdle()

    expect(sendAccountDeleteMock).toHaveBeenCalledTimes(1)

    const [params] = sendAccountDeleteMock.mock.lastCall!
    expect(params).toEqual({
      locale: 'fr',
      token: expect.any(String),
    })

    await page.typeInInput('code', params.token)
    await page.typeInInput('password', 'bob-new-pass')

    await page.clickOnText('Supprimer mon compte')

    // A final confirmation step is displayed
    await page.ensureTextVisibility('Êtes-vous vraiment, vraiment sûr ?', 'h2')

    await page.clickOnText('Oui, supprimer mon compte')

    // Once the account is deleted, the session is gone and the user is
    // brought back to the sign-in page.
    await page.assertTitle('Se connecter')
  })
})
