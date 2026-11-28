import type { Browser } from 'puppeteer'
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { OAuthProvider } from '@atproto/oauth-provider/provider'
import {
  CAPTCHA_FAILED,
  DIALOG,
  DIALOG_SUBMIT,
  RESET_FAILED,
  RESET_REQUEST_FAILED,
  RETRY_IN,
  TEST_TIMEOUT,
  TOO_MANY_ATTEMPTS,
  WINDOW_MS,
  alice,
  captchaRequired,
  expectHcaptchaVerified,
  expectTextHidden,
  hcaptchaPdsConfig,
  isApiEndpoint,
  isCaptchaRequired,
  isRateLimited,
  languages,
  launchBrowser,
  rateLimited,
  setTestRateLimits,
  spyOnHcaptchaVerify,
  submit,
  submitUntil,
  textSelector,
  withToken,
} from './_account-manager-rate-limits.js'
import { PageHelper } from './_puppeteer.js'

describe('account manager rate limits', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let provider: OAuthProvider

  beforeAll(async () => {
    browser = await launchBrowser()

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_manager_rate_limits_reset_password',
      pds: hcaptchaPdsConfig,
    })

    assert(network.pds.ctx.oauthProvider, 'The PDS has no OAuth provider')
    provider = network.pds.ctx.oauthProvider
    setTestRateLimits(provider)

    await network.getSeedClient().createAccount('alice', alice)
  })

  afterAll(async () => {
    await network?.close()
    await browser?.close()
  })

  it(
    'requires a captcha, then blocks, repeated password reset requests',
    async () => {
      using sendResetPasswordMock = vi
        .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
        .mockImplementation(async () => {
          // noop
        })

      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify(provider)
      using resetRequests = page.recordJsonResponses(
        isApiEndpoint('/reset-password-request'),
      )

      // The user did not get the code, and asks for another one
      const requestAnotherCode = async () => {
        await page.assertTitle('Réinitialiser le mot de passe')
        await page.clickOnText('Retour')
        await page.assertTitle('Mot de passe oublié')
      }

      await page.goto(new URL('/account/reset-password', network.pds.url))

      await page.assertTitle('Mot de passe oublié')

      await page.typeInInput('identifier', 'alice@test.com')

      // Codes are sent as usual, until a captcha is required. The challenge is
      // then solved, and the form re-submitted with its token, without the
      // server's demand ever being displayed.
      const captchaExchanges = await submitUntil(
        page,
        resetRequests,
        (exchanges) => exchanges.some(isCaptchaRequired),
        async (exchanges) => {
          expect(exchanges).toMatchObject([{ status: 200 }])
          await requestAnotherCode()
        },
      )

      expect(captchaExchanges).toMatchObject([
        captchaRequired,
        { status: 200, ...withToken },
      ])
      await requestAnotherCode()

      // Further requests go the same way, until the IP is blocked: the user is
      // then told how long to wait, and can't submit in the meantime.
      const blockedExchanges = await submitUntil(
        page,
        resetRequests,
        (exchanges) => exchanges.some(isRateLimited),
        async (exchanges) => {
          expect(exchanges.at(-1)).toMatchObject({ status: 200 })
          await requestAnotherCode()
        },
      )

      expect(blockedExchanges.at(-1)).toMatchObject(rateLimited)
      await page.ensureTextVisibility(TOO_MANY_ATTEMPTS)
      await page.ensureTextVisibility(RETRY_IN)
      await expectTextHidden(page, CAPTCHA_FAILED)
      await page.waitForVisible('button[type="submit"]:disabled')

      await expectHcaptchaVerified(verify)

      // Once the window has elapsed, the user can request a code again
      await page.waitForHidden(
        textSelector(TOO_MANY_ATTEMPTS),
        WINDOW_MS + 5_000,
      )
      await page.waitForVisible('button[type="submit"]:enabled')

      expect((await submit(page, resetRequests)).at(-1)).toMatchObject({
        status: 200,
      })
      await page.assertTitle('Réinitialiser le mot de passe')

      // A code was sent for every request that succeeded
      const exchanges = await resetRequests.wait(0)
      expect(sendResetPasswordMock).toHaveBeenCalledTimes(
        exchanges.filter(({ status }) => status === 200).length,
      )
    },
    TEST_TIMEOUT,
  )

  it(
    'requires a captcha in the password change dialog',
    async () => {
      using sendResetPasswordMock = vi
        .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
        .mockImplementation(async () => {
          // noop
        })

      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify(provider)
      using signIn = page.recordJsonResponses(isApiEndpoint('/sign-in'))
      using resetRequests = page.recordJsonResponses(
        isApiEndpoint('/reset-password-request'),
      )
      using resetConfirms = page.recordJsonResponses(
        isApiEndpoint('/reset-password-confirm'),
      )

      // The user did not get the code, and asks for another one
      const requestAnotherCode = async () => {
        await page.waitForVisible(`${DIALOG} input[name="token"]`)
        await page.clickOn(`${DIALOG} ${textSelector('Retour', 'button')}`)
      }

      await page.goto(new URL('/account/sign-in', network.pds.url))

      await page.assertTitle('Connexion')

      await page.typeInInput('identifier', 'alice.test')
      await page.typeInInput('password', 'alice-pass')

      expect((await submit(page, signIn)).at(-1)).toMatchObject({ status: 200 })
      await page.assertTitle('Mon compte Atmosphère')

      await page.clickOnText('Compte utilisateur', 'a')
      await page.clickOnText('Mot de passe')

      // As on the signed-out page, codes are sent until a captcha is required.
      // The challenge is then solved, and the request re-submitted with its
      // token, without the server's demand ever being displayed.
      const captchaExchanges = await submitUntil(
        page,
        resetRequests,
        (exchanges) => exchanges.some(isCaptchaRequired),
        async (exchanges) => {
          expect(exchanges.at(-1)).toMatchObject({ status: 200 })
          await requestAnotherCode()
        },
        DIALOG_SUBMIT,
      )

      expect(captchaExchanges).toMatchObject([
        captchaRequired,
        { status: 200, ...withToken },
      ])
      await expectTextHidden(page, RESET_REQUEST_FAILED, 'div')

      // The confirmation goes the same way, its token included
      const [{ token }] = sendResetPasswordMock.mock.lastCall!

      await page.typeInInput('token', token)
      await page.typeInInput('password', 'alice-new-pass')

      expect(await submit(page, resetConfirms, DIALOG_SUBMIT)).toMatchObject([
        captchaRequired,
        { status: 200, ...withToken },
      ])
      await page.ensureNotification('Réinitialisation du mot de passe réussie')
      await expectTextHidden(page, RESET_FAILED, 'div')

      await expectHcaptchaVerified(verify)
    },
    TEST_TIMEOUT,
  )
})
