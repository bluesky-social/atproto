import { describe, expect, it, vi } from 'vitest'
import type {
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
  SignInInput,
  SignUpInput,
} from '@atproto/oauth-provider-api'
import type { DeviceId } from '../device/device-id.js'
import { CaptchaRejectedError } from '../errors/captcha-rejected-error.js'
import { CaptchaRequiredError } from '../errors/captcha-required-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import type { HcaptchaConfig } from '../lib/hcaptcha.js'
import type { RequestMetadata } from '../lib/http/request.js'
import type { OAuthHooks } from '../oauth-hooks.js'
import { HCaptchaManager, type HcaptchaVerifyData } from './hcaptcha-manager.js'

const issuer = 'https://pds.example.com'
const deviceId: DeviceId = `dev-${'0'.repeat(32)}`
const deviceMetadata: RequestMetadata = {
  ipAddress: '203.0.113.9',
  userAgent: 'test',
  port: 443,
}

const config: HcaptchaConfig = {
  siteKey: 'site-key',
  secretKey: 'secret-key',
  tokenSalt: 'salt',
  scoreThreshold: 0.5,
}

const signUpInput: SignUpInput = {
  locale: 'en',
  handle: 'alice.test',
  email: 'alice@example.com',
  password: 'correct horse battery staple',
  hcaptchaToken: 'token',
}

const signInInput: SignInInput = {
  locale: 'en',
  identifier: 'alice.test',
  password: 'hunter2',
  hcaptchaToken: 'token',
}

const resetPasswordRequestInput: InitiatePasswordResetInput = {
  locale: 'en',
  identifier: 'alice.test',
  hcaptchaToken: 'token',
}

const resetPasswordConfirmInput: ConfirmResetPasswordInput = {
  token: 'AAAAA-AAAAA',
  password: 'correct horse battery staple',
  hcaptchaToken: 'token',
}

/**
 * Stubs the hCaptcha `/siteverify` endpoint. Must be called before the manager
 * is created, as the hCaptcha client binds `fetch` on construction.
 */
function stubSiteverify(result: { success: boolean; score?: number }) {
  const bodies: URLSearchParams[] = []
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) => {
      bodies.push(new URLSearchParams(await (input as Request).text()))
      return Response.json({
        challenge_ts: new Date().toISOString(),
        hostname: 'pds.example.com',
        ...result,
      })
    })
  return Object.assign(spy, { bodies })
}

describe(HCaptchaManager, () => {
  it('is disabled and verifies nothing when not configured', async () => {
    using fetch = stubSiteverify({ success: true })
    const hooks = { onHcaptchaResult: vi.fn() } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks)

    expect(manager.enabled).toBe(false)
    await expect(
      manager.verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: signInInput,
      }),
    ).resolves.toBeUndefined()

    expect(fetch).not.toHaveBeenCalled()
    expect(hooks.onHcaptchaResult).not.toHaveBeenCalled()
  })

  it.each<HcaptchaVerifyData>([
    { action: 'sign-up', input: { ...signUpInput, hcaptchaToken: undefined } },
    { action: 'sign-in', input: { ...signInInput, hcaptchaToken: undefined } },
    {
      action: 'reset-password-request',
      input: { ...resetPasswordRequestInput, hcaptchaToken: undefined },
    },
    {
      action: 'reset-password-confirm',
      input: { ...resetPasswordConfirmInput, hcaptchaToken: undefined },
    },
  ])('requires a token for $action', async (data) => {
    using fetch = stubSiteverify({ success: true })
    const manager = new HCaptchaManager(issuer, {}, config)

    expect(manager.enabled).toBe(true)
    await expect(
      manager.verify(deviceId, deviceMetadata, data),
    ).rejects.toBeInstanceOf(CaptchaRequiredError)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('verifies sign-up tokens', async () => {
    using fetch = stubSiteverify({ success: true })
    const hooks = { onHcaptchaResult: vi.fn() } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks, config)

    const data = { action: 'sign-up' as const, input: signUpInput }
    const result = await manager.verify(deviceId, deviceMetadata, data)

    expect(result).toMatchObject({ success: true })
    expect(fetch.bodies[0]?.get('behavior_type')).toBe('signup')
    expect(fetch.bodies[0]?.get('response')).toBe('token')
    expect(hooks.onHcaptchaResult).toHaveBeenCalledExactlyOnceWith({
      ...data,
      deviceId,
      deviceMetadata,
      tokens: {
        hashedIp: expect.any(String),
        hashedEmail: expect.any(String),
        hashedIdentifier: expect.any(String),
        hashedUserAgent: expect.any(String),
      },
      result,
    })
  })

  it.each<{
    data: HcaptchaVerifyData
    behaviorType: string | null
    hashedIdentifier: unknown
  }>([
    {
      data: { action: 'sign-in', input: signInInput },
      behaviorType: 'login',
      hashedIdentifier: expect.any(String),
    },
    {
      data: {
        action: 'reset-password-request',
        input: resetPasswordRequestInput,
      },
      behaviorType: null,
      hashedIdentifier: expect.any(String),
    },
    {
      data: {
        action: 'reset-password-confirm',
        input: resetPasswordConfirmInput,
      },
      behaviorType: null,
      hashedIdentifier: undefined,
    },
  ])(
    'verifies $data.action tokens',
    async ({ data, behaviorType, hashedIdentifier }) => {
      using fetch = stubSiteverify({ success: true })
      const hooks = { onHcaptchaResult: vi.fn() } satisfies OAuthHooks
      const manager = new HCaptchaManager(issuer, hooks, config)

      const result = await manager.verify(deviceId, deviceMetadata, data)

      expect(result).toMatchObject({ success: true })
      expect(fetch.bodies[0]?.get('behavior_type')).toBe(behaviorType)
      expect(fetch.bodies[0]?.get('response')).toBe('token')
      // The hook receives the form input as provided
      expect(hooks.onHcaptchaResult).toHaveBeenCalledExactlyOnceWith({
        ...data,
        deviceId,
        deviceMetadata,
        tokens: {
          hashedIp: expect.any(String),
          hashedIdentifier,
          hashedUserAgent: expect.any(String),
        },
        result,
      })
    },
  )

  it('hashes the normalized identifier', async () => {
    using _ = stubSiteverify({ success: true })
    const hooks = { onHcaptchaResult: vi.fn() } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks, config)

    for (const identifier of ['alice.test', ' @Alice.Test '] as const) {
      await manager.verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: { ...signInInput, identifier },
      })
    }

    const [[first], [second]] = hooks.onHcaptchaResult.mock.calls
    expect(first.tokens.hashedIdentifier).toBe(second.tokens.hashedIdentifier)
  })

  it.each([
    { note: 'unsuccessful result', result: { success: false } },
    { note: 'score above threshold', result: { success: true, score: 0.9 } },
  ])('rejects on $note', async ({ result }) => {
    using _ = stubSiteverify(result)
    const hooks = { onHcaptchaResult: vi.fn() } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks, config)

    const err = await manager
      .verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: signInInput,
      })
      .catch((err: unknown) => err)

    // A new captcha must be solved
    expect(err).toBeInstanceOf(CaptchaRejectedError)
    expect((err as CaptchaRejectedError).error_description).toBe(
      'hCaptcha verification failed',
    )
    // The hook sees the result before it is validated
    expect(hooks.onHcaptchaResult).toHaveBeenCalledOnce()
  })

  it.each([
    {
      note: 'hCaptcha is unreachable',
      response: () => Promise.reject(new TypeError('fetch failed')),
    },
    {
      note: 'hCaptcha responds with an error',
      response: async () => new Response('Bad Gateway', { status: 502 }),
    },
    {
      note: 'hCaptcha responds with an unexpected payload',
      response: async () => Response.json({ success: false }),
    },
  ])('rejects when $note', async ({ response }) => {
    using _ = vi.spyOn(globalThis, 'fetch').mockImplementation(response)
    const manager = new HCaptchaManager(issuer, {}, config)

    await expect(
      manager.verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: signInInput,
      }),
    ).rejects.toBeInstanceOf(CaptchaRejectedError)
  })

  it('rejects when the onHcaptchaResult hook fails', async () => {
    using _ = stubSiteverify({ success: true })
    const hooks = {
      onHcaptchaResult: vi.fn().mockRejectedValue(new Error('Hook failure')),
    } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks, config)

    await expect(
      manager.verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: signInInput,
      }),
    ).rejects.toBeInstanceOf(CaptchaRejectedError)
  })

  it('preserves the OAuth errors thrown by the onHcaptchaResult hook', async () => {
    using _ = stubSiteverify({ success: true })
    const hookError = new InvalidRequestError('Denied by the host')
    const hooks = {
      onHcaptchaResult: vi.fn().mockRejectedValue(hookError),
    } satisfies OAuthHooks
    const manager = new HCaptchaManager(issuer, hooks, config)

    await expect(
      manager.verify(deviceId, deviceMetadata, {
        action: 'sign-in',
        input: signInInput,
      }),
    ).rejects.toBe(hookError)
  })
})
