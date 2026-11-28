import type { Browser } from 'puppeteer'
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { OAuthProvider } from '@atproto/oauth-provider/provider'
import {
  CAPTCHA_FAILED,
  RETRY_IN,
  TEST_TIMEOUT,
  TOO_MANY_ATTEMPTS,
  WINDOW_MS,
  WRONG_CREDENTIALS,
  alice,
  captchaRequired,
  expectChallengeReady,
  expectHcaptchaVerified,
  expectTextHidden,
  hcaptchaPdsConfig,
  invalidCredentials,
  isApiEndpoint,
  isCaptchaRequired,
  isRateLimited,
  languages,
  launchBrowser,
  rateLimited,
  recordSolvedChallenges,
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
      dbPostgresSchema: 'account_manager_rate_limits_sign_in',
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
    'requires a captcha, then blocks, repeated sign-in attempts',
    async () => {
      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify(provider)
      using signIn = page.recordJsonResponses(isApiEndpoint('/sign-in'))

      await page.goto(new URL('/account/sign-in', network.pds.url))

      await page.assertTitle('Connexion')

      const challenges = await recordSolvedChallenges(page)

      await page.typeInInput('identifier', 'alice.test')
      await page.typeInInput('password', 'wrong-pass')

      // Failed attempts are reported as such, until a captcha is required. The
      // challenge is then solved, and the form re-submitted with its token,
      // without the server's demand ever being displayed.
      const captchaExchanges = await submitUntil(
        page,
        signIn,
        (exchanges) => exchanges.some(isCaptchaRequired),
        async (exchanges) => {
          expect(exchanges).toMatchObject([invalidCredentials])
          await page.ensureTextVisibility(WRONG_CREDENTIALS)
        },
      )

      expect(captchaExchanges).toMatchObject([
        captchaRequired,
        { ...invalidCredentials, ...withToken },
      ])
      await page.ensureTextVisibility(WRONG_CREDENTIALS)
      await expectTextHidden(page, CAPTCHA_FAILED)
      await expectChallengeReady(challenges, signIn)

      // Every further attempt comes with a fresh token, rather than failing
      // first for lack of one, until the IP is blocked: the user is then told
      // how long to wait, and can't submit in the meantime.
      const blockedExchanges = await submitUntil(
        page,
        signIn,
        (exchanges) => exchanges.some(isRateLimited),
        async (exchanges) => {
          expect(exchanges).toMatchObject([
            { ...invalidCredentials, ...withToken },
          ])
          await page.ensureTextVisibility(WRONG_CREDENTIALS)
          await expectChallengeReady(challenges, signIn)
        },
      )

      expect(blockedExchanges).toMatchObject([{ ...rateLimited, ...withToken }])
      await page.ensureTextVisibility(TOO_MANY_ATTEMPTS)
      await page.ensureTextVisibility(RETRY_IN)
      await page.waitForVisible('button[type="submit"]:disabled')

      await expectHcaptchaVerified(verify)

      // Once the window has elapsed, the user can sign in again
      await page.waitForHidden(
        textSelector(TOO_MANY_ATTEMPTS),
        WINDOW_MS + 5_000,
      )
      await page.waitForVisible('button[type="submit"]:enabled')

      await page.typeInInput('password', 'alice-pass')

      expect((await submit(page, signIn)).at(-1)).toMatchObject({ status: 200 })
      await page.assertTitle('Mon compte Atmosphère')
      await page.ensureTextVisibility('alice.test', 'span')
    },
    TEST_TIMEOUT,
  )
})
