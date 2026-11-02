import assert from 'node:assert'
import { jest } from '@jest/globals'
import { type Browser, launch } from 'puppeteer'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  type OAuthProvider,
  type RateLimitsOptions,
  identifierKey,
  ipKey,
} from '@atproto/oauth-provider/provider'
import { buildOAuthRateLimiterFactory } from '../src/rate-limits.js'
import { PageHelper } from './_puppeteer.js'

// @NOTE Low thresholds, so that both tiers are reached in a few attempts. The
// window must allow enough attempts to reach the block tier (when debugging
// with "slowMo" too), and elapse during the test. The tests advance on what
// the server responds, so they don't depend on the number of attempts, nor on
// all the attempts fitting in a single window.
const WINDOW_MS = 15_000

const testPolicy = {
  captcha: [{ key: identifierKey, points: 2, durationMs: WINDOW_MS }],
  block: [{ key: ipKey, points: 5, durationMs: WINDOW_MS }],
}

// Guards against flows that never reach the expected state
const MAX_ATTEMPTS = 20

// The flows wait for the counters to be replenished, and for hCaptcha
const TEST_TIMEOUT = 120_000

// @NOTE hCaptcha's test keys: the challenge always passes, without any user
// interaction, and its token always passes verification.
// @see {@link https://docs.hcaptcha.com/#integration-testing-test-keys}
const HCAPTCHA_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001'
const HCAPTCHA_SECRET_KEY = '0x0000000000000000000000000000000000000000'
const HCAPTCHA_RESPONSE = '10000000-aaaa-bbbb-cccc-000000000001'

const WRONG_CREDENTIALS = 'Identifiant ou mot de passe incorrect'
const CAPTCHA_FAILED =
  'Impossible de vérifier que vous êtes humain. Veuillez réessayer plus tard.'
const TOO_MANY_ATTEMPTS = 'Trop de tentatives.'
const RETRY_IN = 'Veuillez réessayer dans' // "… # secondes."
const RESET_REQUEST_FAILED =
  'Échec de la demande de réinitialisation du mot de passe'
const RESET_FAILED = 'Échec de la réinitialisation du mot de passe'

const DIALOG = '[role="dialog"]'
const DIALOG_SUBMIT = `${DIALOG} button[type="submit"]`

const invalidCredentials = {
  status: 400,
  body: {
    error: 'invalid_request',
    error_description: 'Invalid identifier or password',
  },
}
const captchaRequired = { status: 400, body: { error: 'captcha_required' } }
const rateLimited = { status: 429, body: { error: 'rate_limit_exceeded' } }
const withToken = { requestBody: { hcaptchaToken: HCAPTCHA_RESPONSE } }

type Recorder = ReturnType<PageHelper['recordJsonResponses']>
type Exchange = Awaited<ReturnType<Recorder['wait']>>[number]

const hasError = (error: string) => (exchange: Exchange) =>
  (exchange.body as { error?: unknown } | undefined)?.error === error
const isCaptchaRequired = hasError('captcha_required')
const isRateLimited = hasError('rate_limit_exceeded')

describe('account manager rate limits', () => {
  let browser: Browser
  let network: TestNetworkNoAppView
  let provider: OAuthProvider

  // @NOTE We are using another language than "en" as default language to
  // test the language negotiation.
  const languages = ['fr-BE', 'fr', 'en-US', 'en']

  /**
   * Spies on the hCaptcha verifications, which reach hCaptcha's actual
   * siteverify endpoint.
   */
  const spyOnHcaptchaVerify = () =>
    jest.spyOn(provider.hcaptchaManager, 'verify')

  /**
   * Asserts that hCaptcha verified tokens, each the token the widget obtained,
   * and accepted all of them.
   */
  const expectHcaptchaVerified = async (
    verify: ReturnType<typeof spyOnHcaptchaVerify>,
  ) => {
    const results = await Promise.allSettled(
      verify.mock.results.map(({ value }) => value),
    )
    // @NOTE Requests that carry no token are rejected without reaching hCaptcha
    const verifications = verify.mock.calls.flatMap(([, , { input }], i) =>
      input.hcaptchaToken == null
        ? []
        : [{ token: input.hcaptchaToken, result: results[i] }],
    )
    expect(verifications.length).toBeGreaterThan(0)
    for (const verification of verifications) {
      expect(verification).toEqual({
        token: HCAPTCHA_RESPONSE,
        result: {
          status: 'fulfilled',
          value: expect.objectContaining({ success: true }),
        },
      })
    }
  }

  beforeAll(async () => {
    browser = await launch({
      browser: 'chrome', // "firefox"

      // For debugging:
      // headless: false,
      // devtools: true,
      // slowMo: 25,
    })

    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account-manager-rate-limits',
      pds: {
        hcaptchaSiteKey: HCAPTCHA_SITE_KEY,
        hcaptchaSecretKey: HCAPTCHA_SECRET_KEY,
        hcaptchaTokenSalt: 'token-salt',
      },
    })

    assert(network.pds.ctx.oauthProvider, 'The PDS has no OAuth provider')
    provider = network.pds.ctx.oauthProvider
    setRateLimits(provider, {
      factory: buildOAuthRateLimiterFactory(),
      policies: {
        'sign-in': testPolicy,
        'reset-password-request': testPolicy,
        // @NOTE No points: every confirmation requires a captcha
        'reset-password-confirm': {
          captcha: [{ key: ipKey, points: 0, durationMs: 0 }],
        },
      },
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

  it(
    'requires a captcha, then blocks, repeated sign-in attempts',
    async () => {
      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify()
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

  it(
    'requires a captcha, then blocks, repeated password reset requests',
    async () => {
      using sendResetPasswordMock = jest
        .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
        .mockImplementation(async () => {
          // noop
        })

      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify()
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
      using sendResetPasswordMock = jest
        .spyOn(network.pds.ctx.mailer, 'sendResetPassword')
        .mockImplementation(async () => {
          // noop
        })

      await using context = await browser.createBrowserContext()
      await using page = await PageHelper.from(context, { languages })
      using verify = spyOnHcaptchaVerify()
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

/**
 * Submits the form, and returns the exchanges it caused: when a captcha is
 * required, the challenge is solved and the form re-submitted, so these end
 * with the first exchange that did not require a captcha.
 */
async function submit(
  page: PageHelper,
  recorder: Recorder,
  selector = 'button[type="submit"]',
) {
  const { length } = await recorder.wait(0)

  await page.clickOn(selector)

  for (let count = length + 1; count <= length + MAX_ATTEMPTS; count++) {
    // @NOTE Solving a challenge involves loading the hCaptcha widget
    const exchanges = await recorder.wait(count, 15_000)
    if (!isCaptchaRequired(exchanges.at(-1)!)) return exchanges.slice(length)
  }

  throw new Error(`Captcha still required after ${MAX_ATTEMPTS} attempts`)
}

/**
 * Submits the form until `done` holds for the exchanges of a submission, which
 * are returned, checking the exchanges of every other submission.
 */
async function submitUntil(
  page: PageHelper,
  recorder: Recorder,
  done: (exchanges: Exchange[]) => boolean,
  check: (exchanges: Exchange[]) => Promise<void>,
  selector?: string,
) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const exchanges = await submit(page, recorder, selector)
    if (done(exchanges)) return exchanges
    await check(exchanges)
  }

  throw new Error(`Not done after ${MAX_ATTEMPTS} attempts`)
}

/**
 * Records, in the page, the id of every hCaptcha widget once it is solved.
 */
async function recordSolvedChallenges(page: PageHelper) {
  await page.evaluate(() => {
    const solved = new Set<string>()
    Object.assign(window, { solvedChallenges: solved })
    new MutationObserver(() => {
      const frames = document.querySelectorAll<HTMLIFrameElement>(
        'iframe[data-hcaptcha-widget-id]',
      )
      for (const { dataset } of frames) {
        if (dataset.hcaptchaResponse) solved.add(dataset.hcaptchaWidgetId!)
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributeFilter: ['data-hcaptcha-response'],
    })
  })

  return {
    /**
     * Waits for at least `count` challenges to be solved.
     */
    wait: async (count: number, timeout = 15_000) => {
      const deadline = Date.now() + timeout
      for (;;) {
        const solved = await page.evaluate(
          () =>
            (window as unknown as { solvedChallenges: Set<string> })
              .solvedChallenges.size,
        )
        if (solved >= count) return
        if (Date.now() > deadline) {
          throw new Error(
            `Timeout waiting for ${count} solved challenges (got ${solved})`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    },
  }
}

/**
 * Asserts that a challenge was solved after every submission that carried a
 * token, so that the next one doesn't wait for hCaptcha, and that the form was
 * not re-submitted with it.
 */
async function expectChallengeReady(
  challenges: Awaited<ReturnType<typeof recordSolvedChallenges>>,
  recorder: Recorder,
) {
  const exchanges = await recorder.wait(0)
  const submitted = exchanges.filter(
    ({ requestBody }) =>
      (requestBody as { hcaptchaToken?: unknown } | undefined)?.hcaptchaToken,
  ).length

  await challenges.wait(submitted + 1)

  await expect(recorder.wait(exchanges.length + 1, 2_000)).rejects.toThrow(
    'Timeout waiting for',
  )
}

/**
 * The PDS does not allow configuring the OAuth rate limit policies, so the
 * provider's rate limit manager is replaced with one using `options`.
 */
function setRateLimits(provider: OAuthProvider, options: RateLimitsOptions) {
  const RateLimitManager = provider.rateLimitManager.constructor as new (
    hcaptchaManager: OAuthProvider['hcaptchaManager'],
    options: RateLimitsOptions,
  ) => OAuthProvider['rateLimitManager']

  Object.assign(provider, {
    rateLimitManager: new RateLimitManager(provider.hcaptchaManager, options),
  })
}

function isApiEndpoint(endpoint: string) {
  return (url: URL) =>
    url.pathname === `/@atproto/oauth-provider/~api${endpoint}`
}

function textSelector(text: string, tag = 'p') {
  return `${tag}::-p-text(${JSON.stringify(text)})`
}

async function expectTextHidden(page: PageHelper, text: string, tag = 'p') {
  await expect(page.ensureTextVisibility(text, tag, 500)).rejects.toThrow(
    'Waiting for selector',
  )
}
