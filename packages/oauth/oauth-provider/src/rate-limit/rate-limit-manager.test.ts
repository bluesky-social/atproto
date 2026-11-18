import { describe, expect, it, vi } from 'vitest'
import type { ClientAuth } from '../client/client-auth.js'
import type { Client } from '../client/client.js'
import type { DeviceId } from '../device/device-id.js'
import { RateLimitExceededError } from '../errors/rate-limit-exceeded-error.js'
import type {
  HCaptchaManager,
  HcaptchaVerifyData,
} from '../hcaptcha/hcaptcha-manager.js'
import type { HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import type { RequestMetadata } from '../lib/http/request.js'
import type { IdentifierString } from '../oauth-store.ts'
import { RateLimitManager } from './rate-limit-manager.js'
import {
  type RateLimitDeviceContext,
  type RateLimitsOptions,
  authenticatedClientKey,
  ipKey,
} from './rate-limit-policies.js'
import type { RateLimiterFactory, RateLimiterOptions } from './rate-limiter.js'

const deviceId: DeviceId = `dev-${'0'.repeat(32)}`
const deviceMetadata: RequestMetadata = { ipAddress: '203.0.113.9', port: 443 }

const client = { id: 'https://client.example/client-metadata.json' } as Client

function userCtx(
  data: HcaptchaVerifyData,
  ipAddress = deviceMetadata.ipAddress,
): RateLimitDeviceContext {
  return {
    kind: 'device',
    deviceId,
    deviceMetadata: { ...deviceMetadata, ipAddress },
    data,
  }
}

const signIn = (identifier: IdentifierString) =>
  userCtx({
    action: 'sign-in',
    input: { locale: 'en', identifier, password: 'password' },
  })

const signUp = () =>
  userCtx({
    action: 'sign-up',
    input: {
      locale: 'en',
      handle: 'alice.test',
      email: 'alice@example.com',
      password: 'password',
      hcaptchaToken: 'token',
    },
  })

const resetPasswordRequest = (identifier: IdentifierString) =>
  userCtx({
    action: 'reset-password-request',
    input: { locale: 'en', identifier, hcaptchaToken: 'token' },
  })

const resetPasswordConfirm = (ipAddress?: string) =>
  userCtx(
    {
      action: 'reset-password-confirm',
      input: { token: 'AAAAA-AAAAA', password: 'password' },
    },
    ipAddress,
  )

/**
 * In-memory fixed window limiter that never expires, recording calls per
 * limiter name.
 */
function memoryFactory() {
  const limiters = new Map<
    string,
    {
      options: RateLimiterOptions
      hits: Map<string, number>
      consume: ReturnType<typeof vi.fn>
    }
  >()

  const factory: RateLimiterFactory = (options) => {
    const hits = new Map<string, number>()
    const limiter = {
      consume: vi.fn(async (key: string, points = 1) => {
        const count = (hits.get(key) ?? 0) + points
        hits.set(key, count)
        return {
          remainingPoints: options.points - count,
          msBeforeNext: options.durationMs,
        }
      }),
    }
    limiters.set(options.name, { options, hits, ...limiter })
    return limiter
  }

  const limiter = (name: string) => {
    const entry = limiters.get(name)
    if (!entry) throw new Error(`No limiter named ${name}`)
    return entry
  }

  return { factory, limiters, limiter }
}

function setup({
  hcaptcha = true,
  ...options
}: Partial<RateLimitsOptions> & { hcaptcha?: boolean } = {}) {
  const { factory, limiters, limiter } = memoryFactory()
  const hcaptchaManager = {
    enabled: hcaptcha,
    verify: vi.fn(
      async (): Promise<HcaptchaVerifyResult | undefined> => undefined,
    ),
  }
  const manager = new RateLimitManager(
    hcaptchaManager as unknown as HCaptchaManager,
    { factory, ...options },
  )
  return { manager, hcaptchaManager, limiters, limiter }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.fail('Expected the promise to reject'),
    (err: unknown) => err,
  )
}

describe(RateLimitManager, () => {
  describe('construction', () => {
    it('creates one limiter per rule, with stable names', () => {
      const { limiters } = setup()

      expect([...limiters.keys()]).toEqual(
        expect.arrayContaining([
          'oauth-sign-in-captcha-0-900000',
          'oauth-sign-in-captcha-1-900000',
          'oauth-sign-in-block-0-300000',
          'oauth-sign-in-block-1-86400000',
          'oauth-sign-in-block-2-300000',
          'oauth-sign-up-block-0-3600000',
          'oauth-sign-up-block-1-86400000',
          'oauth-reset-password-confirm-captcha-0-900000',
          'oauth-reset-password-confirm-block-0-300000',
          'oauth-pushed-authorization-request-block-0-300000',
        ]),
      )
      expect(limiters.get('oauth-sign-in-captcha-0-900000')?.options).toEqual({
        name: 'oauth-sign-in-captcha-0-900000',
        points: 5,
        durationMs: 900_000,
      })
    })

    it('does not create captcha tier limiters when hCaptcha is disabled', () => {
      const { limiters } = setup({ hcaptcha: false })

      expect(limiters.size).toBeGreaterThan(0)
      for (const name of limiters.keys()) {
        expect(name).not.toContain('-captcha-')
      }
    })

    it('replaces a tier wholesale when overridden', () => {
      const { limiters } = setup({
        policies: {
          'sign-in': {
            captcha: [{ key: ipKey, points: 2, durationMs: 1000 }],
          },
        },
      })

      const signIn = [...limiters.keys()].filter((name) =>
        name.startsWith('oauth-sign-in-'),
      )
      expect(signIn).toEqual([
        'oauth-sign-in-captcha-0-1000',
        'oauth-sign-in-block-0-300000',
        'oauth-sign-in-block-1-86400000',
        'oauth-sign-in-block-2-300000',
      ])
    })

    it('gives similar rules distinct limiters', () => {
      const rule = { key: ipKey, points: 1, durationMs: 1000 }
      const { limiters } = setup({
        policies: {
          'pushed-authorization-request': {
            block: [rule, { ...rule, points: 2 }],
          },
        },
      })

      expect(
        limiters.get('oauth-pushed-authorization-request-block-0-1000')?.options
          .points,
      ).toBe(1)
      expect(
        limiters.get('oauth-pushed-authorization-request-block-1-1000')?.options
          .points,
      ).toBe(2)
    })

    it("only accepts rules compatible with the policy's context", () => {
      setup({
        policies: {
          'sign-in': {
            block: [
              // @ts-expect-error The sign-in context provides no client
              { key: authenticatedClientKey, points: 1, durationMs: 1 },
            ],
          },
        },
      })
    })

    it('only supports a captcha tier on policies that can verify a captcha', () => {
      const rule = { key: ipKey, points: 1, durationMs: 1000 }

      expect(() =>
        setup({
          // @ts-expect-error PAR requests carry no captcha data
          policies: { 'pushed-authorization-request': { captcha: [rule] } },
        }),
      ).toThrow(TypeError)
    })
  })

  it('only enforces the rules without points when rate limits are not configured', async () => {
    const hcaptchaManager = { enabled: true, verify: vi.fn() }
    const manager = new RateLimitManager(
      hcaptchaManager as unknown as HCaptchaManager,
    )
    for (let i = 0; i < 1000; i++) {
      await manager.consume(
        'reset-password-request',
        resetPasswordRequest('a@b.com'),
      )
      await manager.consume('sign-in', signIn('alice.test'))
    }

    expect(hcaptchaManager.verify).not.toHaveBeenCalled()

    // The default sign-up captcha tier rule has no points
    const ctx = signUp()
    await manager.consume('sign-up', ctx)
    expect(hcaptchaManager.verify).toHaveBeenCalledExactlyOnceWith(
      deviceId,
      deviceMetadata,
      ctx.data,
    )
  })

  describe('consume', () => {
    it('rejects once a block tier rule is exceeded', async () => {
      const { manager } = setup({
        policies: {
          'reset-password-confirm': {
            block: [{ key: ipKey, points: 2, durationMs: 1500 }],
          },
        },
      })

      await manager.consume('reset-password-confirm', resetPasswordConfirm())
      await manager.consume('reset-password-confirm', resetPasswordConfirm())

      const err = await rejectionOf(
        manager.consume('reset-password-confirm', resetPasswordConfirm()),
      )
      expect(err).toBeInstanceOf(RateLimitExceededError)
      expect(err).toMatchObject({
        status: 429,
        error: 'rate_limit_exceeded',
        retryAfter: 2,
      })

      // Other IPs are not affected
      await manager.consume(
        'reset-password-confirm',
        resetPasswordConfirm('198.51.100.1'),
      )
    })

    it('verifies the captcha once a captcha tier rule is exceeded', async () => {
      const { manager, hcaptchaManager } = setup({
        policies: {
          'reset-password-request': {
            captcha: [{ key: ipKey, points: 2, durationMs: 1000 }],
          },
        },
      })

      const ctx = resetPasswordRequest('alice@example.com')

      // A token sent below the threshold is ignored
      await manager.consume('reset-password-request', ctx)
      await manager.consume('reset-password-request', ctx)
      expect(hcaptchaManager.verify).not.toHaveBeenCalled()

      await manager.consume('reset-password-request', ctx)
      expect(hcaptchaManager.verify).toHaveBeenCalledExactlyOnceWith(
        deviceId,
        deviceMetadata,
        ctx.data,
      )

      // Solving a captcha does not reset the counters
      await manager.consume('reset-password-request', ctx)
      expect(hcaptchaManager.verify).toHaveBeenCalledTimes(2)
    })

    it('always exceeds rules without points, without a limiter', async () => {
      const { manager, hcaptchaManager, limiters } = setup()
      const ctx = signUp()

      for (const name of limiters.keys()) {
        expect(name).not.toContain('oauth-sign-up-captcha-')
      }

      await manager.consume('sign-up', ctx)
      expect(hcaptchaManager.verify).toHaveBeenCalledExactlyOnceWith(
        deviceId,
        deviceMetadata,
        ctx.data,
      )
    })

    it('keys on the normalized identifier', async () => {
      const { manager, limiter } = setup()

      await manager.consume('sign-in', signIn(' Alice.Test '))
      await manager.consume(
        'reset-password-request',
        resetPasswordRequest('ALICE@example.com'),
      )

      expect(
        limiter('oauth-sign-in-block-0-300000').consume,
      ).toHaveBeenCalledExactlyOnceWith(
        `alice.test ${deviceMetadata.ipAddress}`,
        1,
      )
      expect(
        limiter('oauth-reset-password-request-captcha-0-3600000').consume,
      ).toHaveBeenCalledExactlyOnceWith('alice@example.com', 1)
    })

    it('keys on whatever custom rules compute', async () => {
      const key = vi.fn(({ data }: RateLimitDeviceContext) =>
        data.action === 'reset-password-request' &&
        data.input.identifier.includes('@')
          ? `domain:${data.input.identifier.split('@')[1]}`
          : null,
      )
      const { manager, limiter } = setup({
        policies: {
          'reset-password-request': {
            block: [{ key, points: 10, durationMs: 1000 }],
          },
        },
      })
      const ctx = resetPasswordRequest('alice@example.com')

      await manager.consume(
        'reset-password-request',
        resetPasswordRequest('alice.test'),
      )
      await manager.consume('reset-password-request', ctx)

      // Rules receive the context provided by the policy
      expect(key).toHaveBeenLastCalledWith(ctx)
      // Not consumed when the key getter returned null
      expect(
        limiter('oauth-reset-password-request-block-0-1000').consume,
      ).toHaveBeenCalledExactlyOnceWith('domain:example.com', 1)
    })

    it('keys PAR on the client, and on the IP address for public clients', async () => {
      const { manager, limiter } = setup()
      const { id } = client

      await manager.consume('pushed-authorization-request', {
        kind: 'client',
        deviceMetadata,
        client,
        clientAuth: { method: 'private_key_jwt' } as ClientAuth,
      })
      await manager.consume('pushed-authorization-request', {
        kind: 'client',
        deviceMetadata,
        client,
        clientAuth: { method: 'none' },
      })

      // Authenticated clients have their own (higher) budget
      const authenticated = limiter(
        'oauth-pushed-authorization-request-block-0-300000',
      )
      expect(authenticated.options.points).toBe(3000)
      expect(authenticated.consume).toHaveBeenCalledExactlyOnceWith(id, 1)

      const anonymous = limiter(
        'oauth-pushed-authorization-request-block-1-300000',
      )
      expect(anonymous.options.points).toBe(50)
      expect(anonymous.consume).toHaveBeenCalledExactlyOnceWith(
        `${id} ${deviceMetadata.ipAddress}`,
        1,
      )
    })

    it('neither checks nor consumes captcha tier rules without hCaptcha', async () => {
      const { manager, hcaptchaManager } = setup({
        hcaptcha: false,
        policies: {
          'reset-password-request': {
            captcha: [{ key: ipKey, points: 0, durationMs: 1000 }],
          },
        },
      })

      await manager.consume(
        'reset-password-request',
        resetPasswordRequest('alice@example.com'),
      )
      await manager.consume('sign-up', signUp())
      expect(hcaptchaManager.verify).not.toHaveBeenCalled()
    })
  })
})
