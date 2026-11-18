import crypto from 'node:crypto'
import { once } from 'node:events'
import { type Server, createServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@atproto/oauth-provider-api'
import {
  API_ENDPOINT_PREFIX,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@atproto/oauth-provider-api'
import type { AccountStore } from '../account/account-store.js'
import { InvalidCredentialsError } from '../errors/invalid-credentials-error.js'
import { SecondAuthenticationFactorRequiredError } from '../errors/second-authentication-factor-required-error.js'
import type { HcaptchaConfig } from '../lib/hcaptcha.js'
import { asHandler } from '../lib/http/middleware.js'
import {
  AccessTokenMode,
  JoseKey,
  Keyset,
  OAuthProvider,
  type RateLimiterFactory,
  type RateLimitsOptions,
  identifierKey,
  ipKey,
} from '../oauth-provider.js'
import { createApiMiddleware } from './create-api-middleware.js'

/**
 * The account API routes apply the rate limits and captcha verifications
 * around the AccountManager methods (which are unaware of them).
 */

const ISSUER = 'https://pds.example.com'
const CSRF = 'c'.repeat(24)

const hcaptcha: HcaptchaConfig = {
  siteKey: 'site-key',
  secretKey: 'secret-key',
  tokenSalt: 'salt',
}

const alice = {
  did: 'did:plc:2ihkmqhirw5tturitpdyf2fa',
  pds: 'did:web:pds.example.com',
  deactivated: false,
  handle: 'alice.test',
  email: 'alice@example.com',
} as Account

/**
 * In-memory limiter factory that records the points consumed, per limiter name.
 */
function memoryFactory() {
  const consumed = new Map<string, number>()
  const factory: RateLimiterFactory = ({ name, points, durationMs }) => {
    const hits = new Map<string, number>()
    return {
      consume: async (key, n) => {
        consumed.set(name, (consumed.get(name) ?? 0) + n)
        const count = (hits.get(key) ?? 0) + n
        hits.set(key, count)
        return {
          remainingPoints: points - count,
          msBeforeNext: durationMs,
        }
      },
    }
  }
  return { factory, consumed }
}

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))),
  )
})

async function startApi({
  rateLimits,
  hcaptcha,
}: {
  rateLimits?: RateLimitsOptions
  hcaptcha?: HcaptchaConfig
}) {
  const devices = new Map<string, Record<string, unknown>>()
  const noop = async () => {}

  // Only the members this test reaches are real; the rest are inert.
  const store = {
    deactivateAccount: noop,
    deleteAccountConfirm: noop,
    deleteAccountRequest: noop,
    enableEmailAuthFactor: noop,
    disableEmailAuthFactor: noop,
    getAccount: async () => null,
    getDeviceAccount: async () => null,
    reactivateAccount: noop,
    resetPasswordConfirm: vi.fn(async () => alice),
    setAuthorizedClient: noop,
    updateEmailConfirm: noop,
    updateEmailRequest: async () => ({ tokenRequired: false }),
    updateHandle: noop,
    verifyEmailConfirm: noop,
    verifyEmailRequest: noop,
    verifyHandleAvailability: noop,
    findLexicon: async () => null,
    storeLexicon: noop,
    deleteLexicon: noop,
    createRequest: noop,
    readRequest: async () => null,
    updateRequest: noop,
    deleteRequest: noop,
    consumeRequestCode: async () => null,
    createToken: noop,
    readToken: async () => null,
    deleteToken: noop,
    rotateToken: noop,
    findTokenByRefreshToken: async () => null,
    findTokenByCode: async () => null,
    listAccountTokens: async () => [],
    authenticateAccount: vi.fn(
      async ({ password }: { password: string }): Promise<Account> => {
        if (password === 'otp') {
          throw new SecondAuthenticationFactorRequiredError('emailOtp', 'a***')
        }
        if (password !== 'password') {
          throw new InvalidCredentialsError(alice.did)
        }
        return alice
      },
    ),
    createAccount: vi.fn(async () => alice),
    resetPasswordRequest: vi.fn(async () => alice),
    listDeviceAccounts: vi.fn(async () => []),
    removeDeviceAccount: vi.fn(async () => {}),
    upsertDeviceAccount: vi.fn(async () => {}),
    createDevice: async (id: string, data: Record<string, unknown>) => {
      devices.set(id, data)
    },
    readDevice: async (id: string) => devices.get(id) ?? null,
    updateDevice: async (id: string, data: Record<string, unknown>) => {
      devices.set(id, { ...devices.get(id), ...data })
    },
    deleteDevice: async (id: string) => {
      devices.delete(id)
    },
  }

  const hooks = {
    onResetPasswordRequest: vi.fn(),
    onSignInAttempt: vi.fn(),
    onHcaptchaResult: vi.fn(),
  }

  const provider = new OAuthProvider({
    store: store as unknown as AccountStore,
    issuer: ISSUER,
    keyset: new Keyset([
      await JoseKey.fromKeyLike(crypto.randomBytes(32), 'k1', 'HS256'),
    ]),
    safeFetch: globalThis.fetch,
    accessTokenMode: AccessTokenMode.stateless,
    inviteCodeRequired: false,
    rateLimits,
    hcaptcha,
    ...hooks,
  })

  const server = createServer(asHandler(createApiMiddleware(provider, {})))
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  // node:http rather than fetch(): Sec-Fetch-* are forbidden header names.
  const post = (endpoint: string, body: unknown) =>
    new Promise<{
      status: number
      headers: Record<string, string | string[] | undefined>
      json: Record<string, unknown>
    }>((resolve, reject) => {
      const payload = JSON.stringify(body)
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: (server.address() as AddressInfo).port,
          method: 'POST',
          path: `${API_ENDPOINT_PREFIX}${endpoint}`,
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
            cookie: `${CSRF_COOKIE_NAME}=${CSRF}`,
            [CSRF_HEADER_NAME]: CSRF,
            'sec-fetch-mode': 'same-origin',
            'sec-fetch-site': 'same-origin',
            origin: ISSUER,
            referer: `${ISSUER}/account`,
          },
        },
        (res) => {
          let text = ''
          res.on('data', (chunk) => (text += chunk))
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              json: JSON.parse(text),
            }),
          )
        },
      )
      req.on('error', reject)
      req.end(payload)
    })

  return { post, store, hooks }
}

describe('/sign-in', () => {
  const signIn = (
    post: Awaited<ReturnType<typeof startApi>>['post'],
    password: string,
  ) => post('/sign-in', { locale: 'en', identifier: 'alice.test', password })

  it('counts every attempt, whatever its outcome', async () => {
    const { factory, consumed } = memoryFactory()
    const { post, store } = await startApi({
      hcaptcha,
      rateLimits: {
        factory,
        policies: {
          'sign-in': {
            captcha: [
              {
                key: identifierKey,
                points: 3,
                durationMs: 60_000,
              },
            ],
          },
        },
      },
    })

    await expect(signIn(post, 'password')).resolves.toMatchObject({
      status: 200,
    })
    await expect(signIn(post, 'otp')).resolves.toMatchObject({
      json: { error: 'second_authentication_factor_required' },
    })
    await expect(signIn(post, 'wrong')).resolves.toMatchObject({
      json: { error_description: 'Invalid identifier or password' },
    })

    // The (N+1)th attempt requires a captcha, even with valid credentials
    await expect(signIn(post, 'password')).resolves.toMatchObject({
      status: 400,
      json: { error: 'captcha_required' },
    })

    expect(store.authenticateAccount).toHaveBeenCalledTimes(3)
    expect(consumed.get('oauth-sign-in-captcha-0-60000')).toBe(4)
  }, 5_000) // constantTime() pads every sign-in attempt to 400ms

  it('responds with 429 and a Retry-After header once blocked', async () => {
    const { factory } = memoryFactory()
    const { post, store } = await startApi({
      rateLimits: {
        factory,
        policies: {
          'sign-in': {
            block: [{ key: ipKey, points: 1, durationMs: 60_000 }],
          },
        },
      },
    })

    await expect(signIn(post, 'password')).resolves.toMatchObject({
      status: 200,
    })
    await expect(signIn(post, 'password')).resolves.toMatchObject({
      status: 429,
      headers: { 'retry-after': '60' },
      json: { error: 'rate_limit_exceeded' },
    })

    expect(store.authenticateAccount).toHaveBeenCalledOnce()
  }, 5_000)

  it('forwards the form input, hCaptcha token included, to the hooks', async () => {
    const { post, hooks } = await startApi({})
    const input = {
      locale: 'en',
      identifier: 'alice.test',
      password: 'password',
      hcaptchaToken: 'token',
    }

    await expect(post('/sign-in', input)).resolves.toMatchObject({
      status: 200,
    })

    expect(hooks.onSignInAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ input }),
    )
  }, 2_000) // constantTime() pads every sign-in attempt to 400ms
})

describe('/sign-up', () => {
  it.each([
    { note: 'without rate limits', rateLimits: undefined },
    {
      note: 'with rate limits',
      rateLimits: { factory: memoryFactory().factory },
    },
  ])('always requires a captcha $note', async ({ rateLimits }) => {
    const { post, store } = await startApi({ hcaptcha, rateLimits })

    await expect(
      post('/sign-up', {
        locale: 'en',
        handle: 'alice.test',
        email: 'alice@example.com',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      status: 400,
      json: { error: 'captcha_required' },
    })

    expect(store.createAccount).not.toHaveBeenCalled()
  })

  it('rejects a captcha that fails verification', async () => {
    // Stubs hCaptcha's siteverify, before the client binds fetch
    using _ = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      Response.json({
        success: false,
        challenge_ts: new Date().toISOString(),
        hostname: 'pds.example.com',
      }),
    )
    const { post, store } = await startApi({ hcaptcha })

    await expect(
      post('/sign-up', {
        locale: 'en',
        handle: 'alice.test',
        email: 'alice@example.com',
        password: 'correct horse battery staple',
        hcaptchaToken: 'token',
      }),
    ).resolves.toMatchObject({
      status: 400,
      json: { error: 'captcha_rejected' },
    })

    expect(store.createAccount).not.toHaveBeenCalled()
  })

  it('provides the hCaptcha result to the onHcaptchaResult hook', async () => {
    // Stubs hCaptcha's siteverify, before the client binds fetch
    using _ = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      Response.json({
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'pds.example.com',
      }),
    )
    const { post, hooks } = await startApi({ hcaptcha })

    await expect(
      post('/sign-up', {
        locale: 'en',
        handle: 'alice.test',
        email: 'alice@example.com',
        password: 'correct horse battery staple',
        hcaptchaToken: 'token',
      }),
    ).resolves.toMatchObject({ status: 200 })

    expect(hooks.onHcaptchaResult).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        action: 'sign-up',
        result: expect.objectContaining({ success: true }),
      }),
    )
  }, 2_000) // constantTime() pads every sign-up attempt to 400ms
})

describe('/reset-password-request', () => {
  it('forwards the form input, hCaptcha token included, to the store and hooks', async () => {
    const { post, store, hooks } = await startApi({})
    const input = {
      identifier: 'alice@example.com',
      locale: 'en',
      hcaptchaToken: 'token',
    }

    await expect(post('/reset-password-request', input)).resolves.toMatchObject(
      { status: 200 },
    )

    expect(store.resetPasswordRequest).toHaveBeenCalledWith(input)
    expect(hooks.onResetPasswordRequest).toHaveBeenCalledWith(
      expect.objectContaining({ input }),
    )
  }, 2_000) // constantTime() pads the email path to 400ms
})

describe('/reset-password-confirm', () => {
  it('requires a captcha once its captcha tier is exceeded', async () => {
    const { post, store } = await startApi({
      hcaptcha,
      rateLimits: {
        factory: memoryFactory().factory,
        policies: {
          'reset-password-confirm': {
            captcha: [{ key: ipKey, points: 1, durationMs: 60_000 }],
          },
        },
      },
    })
    const input = { token: 'AAAAA-AAAAA', password: 'correct horse battery' }

    await expect(post('/reset-password-confirm', input)).resolves.toMatchObject(
      { status: 200, json: { success: true } },
    )

    await expect(post('/reset-password-confirm', input)).resolves.toMatchObject(
      {
        status: 400,
        json: { error: 'captcha_required' },
      },
    )

    expect(store.resetPasswordConfirm).toHaveBeenCalledOnce()
  }, 2_000) // constantTime() pads every confirmation to 400ms
})
