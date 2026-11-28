import { type Browser, launch } from 'puppeteer'
import { expect, vi } from 'vitest'
import {
  type OAuthProvider,
  type RateLimitsOptions,
  identifierKey,
  ipKey,
} from '@atproto/oauth-provider/provider'
import { buildOAuthRateLimiterFactory } from '../src/rate-limits.js'
import type { PageHelper } from './_puppeteer.js'

// @NOTE Low thresholds, so that both tiers are reached in a few attempts. The
// window must allow enough attempts to reach the block tier (when debugging
// with "slowMo" too), and elapse during the test. The tests advance on what
// the server responds, so they don't depend on the number of attempts, nor on
// all the attempts fitting in a single window.
export const WINDOW_MS = 15_000

const testPolicy = {
  captcha: [{ key: identifierKey, points: 2, durationMs: WINDOW_MS }],
  block: [{ key: ipKey, points: 5, durationMs: WINDOW_MS }],
}

// Guards against flows that never reach the expected state
const MAX_ATTEMPTS = 20

// The flows wait for the counters to be replenished, and for hCaptcha
export const TEST_TIMEOUT = 120_000

// @NOTE hCaptcha's test keys: the challenge always passes, without any user
// interaction, and its token always passes verification.
// @see {@link https://docs.hcaptcha.com/#integration-testing-test-keys}
const HCAPTCHA_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001'
const HCAPTCHA_SECRET_KEY = '0x0000000000000000000000000000000000000000'
const HCAPTCHA_RESPONSE = '10000000-aaaa-bbbb-cccc-000000000001'

export const WRONG_CREDENTIALS = 'Identifiant ou mot de passe incorrect'
export const CAPTCHA_FAILED =
  'Impossible de vérifier que vous êtes humain. Veuillez réessayer plus tard.'
export const TOO_MANY_ATTEMPTS = 'Trop de tentatives.'
export const RETRY_IN = 'Veuillez réessayer dans' // "… # secondes."
export const RESET_REQUEST_FAILED =
  'Échec de la demande de réinitialisation du mot de passe'
export const RESET_FAILED = 'Échec de la réinitialisation du mot de passe'

export const DIALOG = '[role="dialog"]'
export const DIALOG_SUBMIT = `${DIALOG} button[type="submit"]`

export const invalidCredentials = {
  status: 400,
  body: {
    error: 'invalid_request',
    error_description: 'Invalid identifier or password',
  },
}
export const captchaRequired = {
  status: 400,
  body: { error: 'captcha_required' },
}
export const rateLimited = {
  status: 429,
  body: { error: 'rate_limit_exceeded' },
}
export const withToken = { requestBody: { hcaptchaToken: HCAPTCHA_RESPONSE } }

type Recorder = ReturnType<PageHelper['recordJsonResponses']>
type Exchange = Awaited<ReturnType<Recorder['wait']>>[number]

const hasError = (error: string) => (exchange: Exchange) =>
  (exchange.body as { error?: unknown } | undefined)?.error === error
export const isCaptchaRequired = hasError('captcha_required')
export const isRateLimited = hasError('rate_limit_exceeded')

// @NOTE We are using another language than "en" as default language to
// test the language negotiation.
export const languages = ['fr-BE', 'fr', 'en-US', 'en']

export const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  password: 'alice-pass',
} as const

/**
 * PDS config enabling hCaptcha, with its test keys.
 */
export const hcaptchaPdsConfig = {
  hcaptchaSiteKey: HCAPTCHA_SITE_KEY,
  hcaptchaSecretKey: HCAPTCHA_SECRET_KEY,
  hcaptchaTokenSalt: 'token-salt',
}

export function launchBrowser(): Promise<Browser> {
  return launch({
    browser: 'chrome', // "firefox"

    // For debugging:
    // headless: false,
    // devtools: true,
    // slowMo: 25,
  })
}

/**
 * Applies the low test thresholds to the provider's rate limits.
 */
export function setTestRateLimits(provider: OAuthProvider) {
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
}

/**
 * Spies on the hCaptcha verifications, which reach hCaptcha's actual
 * siteverify endpoint.
 */
export const spyOnHcaptchaVerify = (provider: OAuthProvider) =>
  vi.spyOn(provider.hcaptchaManager, 'verify')

/**
 * Asserts that hCaptcha verified tokens, each the token the widget obtained,
 * and accepted all of them.
 */
export async function expectHcaptchaVerified(
  verify: ReturnType<typeof spyOnHcaptchaVerify>,
) {
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

/**
 * Submits the form, and returns the exchanges it caused: when a captcha is
 * required, the challenge is solved and the form re-submitted, so these end
 * with the first exchange that did not require a captcha.
 */
export async function submit(
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
export async function submitUntil(
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
export async function recordSolvedChallenges(page: PageHelper) {
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
export async function expectChallengeReady(
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

export function isApiEndpoint(endpoint: string) {
  return (url: URL) =>
    url.pathname === `/@atproto/oauth-provider/~api${endpoint}`
}

export function textSelector(text: string, tag = 'p') {
  return `${tag}::-p-text(${JSON.stringify(text)})`
}

export async function expectTextHidden(
  page: PageHelper,
  text: string,
  tag = 'p',
) {
  await expect(page.ensureTextVisibility(text, tag, 500)).rejects.toThrow(
    'Waiting for selector',
  )
}
