import { describe, expect, it, vi } from 'vitest'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthResolver } from '@atproto/oauth-resolver'
import type { OAuthIssuerIdentifier } from '@atproto/oauth-types'
import type { DeviceId } from '../device/device-id.js'
import { UnknownAtprotoAccountError } from '../errors/unknown-atproto-account-error.js'
import type { RequestMetadata } from '../lib/http/request.js'
import type { OAuthHooks } from '../oauth-hooks.js'
import { AccountManager } from './account-manager.js'
import type { AccountStore } from './account-store.js'

type ResolveResult = Awaited<ReturnType<OAuthResolver['resolve']>>

const issuer: OAuthIssuerIdentifier = 'https://pds.example.com'
const otherIssuer: OAuthIssuerIdentifier = 'https://entryway.other.example'

const deviceId: DeviceId = `dev-${'0'.repeat(32)}`
const deviceMetadata: RequestMetadata = { ipAddress: '127.0.0.1', port: 443 }

const aliceDid = 'did:plc:2ihkmqhirw5tturitpdyf2fa'
const bobDid = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'

const alice = {
  did: aliceDid,
  pds: 'did:web:pds.example.com',
  deactivated: false,
  handle: 'alice.test',
  email: 'alice@example.com',
} as Account

function setup({
  account = null,
  resolved,
}: {
  /** What `store.getAccount()` and `store.resetPasswordRequest()` return. */
  account?: Account | null
  /** What `oauthResolver.resolve()` resolves to, or rejects with. */
  resolved?: ResolveResult | Error
} = {}) {
  const store = {
    getAccount: vi.fn(async () =>
      account ? { account, authorizedClients: new Map() } : null,
    ),
    resetPasswordRequest: vi.fn(async () => account),
  } satisfies Pick<AccountStore, 'getAccount' | 'resetPasswordRequest'>

  const hooks = {
    onResetPasswordRequest: vi.fn(),
    onResetPasswordRequested: vi.fn(),
  } satisfies OAuthHooks

  const resolver = {
    resolve: vi.fn(async (): Promise<ResolveResult> => {
      if (resolved === undefined) throw new Error('Unexpected resolution')
      if (resolved instanceof Error) throw resolved
      return resolved
    }),
  } satisfies Pick<OAuthResolver, 'resolve'>

  const manager = new AccountManager(
    issuer,
    store as unknown as AccountStore,
    hooks,
    resolver as unknown as OAuthResolver,
    {},
  )

  return { manager, store, hooks, resolver }
}

function resolvedTo(
  metadataIssuer: OAuthIssuerIdentifier,
  handle?: string,
): ResolveResult {
  return {
    identityInfo:
      handle === undefined
        ? undefined
        : ({ did: bobDid, handle } as unknown as ResolveResult['identityInfo']),
    metadata: { issuer: metadataIssuer } as ResolveResult['metadata'],
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (err) {
    return err
  }
  expect.fail('Expected the promise to reject')
}

describe('AccountManager.resetPasswordRequest', () => {
  describe('with an at-identifier', () => {
    it.each([aliceDid, 'alice.test'])(
      'requires an email address when %j is hosted here',
      async (identifier) => {
        const { manager, store, resolver } = setup({ account: alice })

        const err = await rejectionOf(
          manager.resetPasswordRequest(deviceId, deviceMetadata, {
            locale: 'en',
            identifier,
          }),
        )

        expect(err).toBeInstanceOf(UnknownAtprotoAccountError)
        expect((err as UnknownAtprotoAccountError).toJSON()).toStrictEqual({
          error: 'unknown_atproto_account_error',
          error_description: 'An email address is required for password reset',
          identifier,
          issuer: undefined,
        })

        expect(store.getAccount).toHaveBeenCalledWith(identifier)
        expect(resolver.resolve).not.toHaveBeenCalled()
        expect(store.resetPasswordRequest).not.toHaveBeenCalled()
      },
    )

    it('directs the user to the service hosting the identity', async () => {
      const { manager, store, resolver } = setup({
        resolved: resolvedTo(otherIssuer, 'bob.other.example'),
      })

      const err = await rejectionOf(
        manager.resetPasswordRequest(deviceId, deviceMetadata, {
          locale: 'en',
          identifier: bobDid,
        }),
      )

      expect(err).toBeInstanceOf(UnknownAtprotoAccountError)
      expect((err as UnknownAtprotoAccountError).toJSON()).toStrictEqual({
        error: 'unknown_atproto_account_error',
        error_description: `Atmosphere account bob.other.example is hosted on ${otherIssuer}`,
        identifier: 'bob.other.example',
        issuer: otherIssuer,
      })

      expect(store.getAccount).toHaveBeenCalledWith(bobDid)
      expect(resolver.resolve).toHaveBeenCalledWith(bobDid)
      expect(store.resetPasswordRequest).not.toHaveBeenCalled()
    })

    it.each([
      ['an invalid handle', 'handle.invalid'],
      ['no identity info', undefined],
    ])(
      'falls back to the input identifier when resolution yields %s',
      async (_label, handle) => {
        const { manager } = setup({
          resolved: resolvedTo(otherIssuer, handle),
        })

        const err = await rejectionOf(
          manager.resetPasswordRequest(deviceId, deviceMetadata, {
            locale: 'en',
            identifier: bobDid,
          }),
        )

        expect(err).toBeInstanceOf(UnknownAtprotoAccountError)
        expect((err as UnknownAtprotoAccountError).toJSON()).toStrictEqual({
          error: 'unknown_atproto_account_error',
          error_description: `Atmosphere account ${bobDid} is hosted on ${otherIssuer}`,
          identifier: bobDid,
          issuer: otherIssuer,
        })
      },
    )

    it('omits the issuer when the identity resolves back to this service', async () => {
      const { manager } = setup({
        resolved: resolvedTo(issuer, 'bob.test'),
      })

      const err = await rejectionOf(
        manager.resetPasswordRequest(deviceId, deviceMetadata, {
          locale: 'en',
          identifier: 'bob.test',
        }),
      )

      expect(err).toBeInstanceOf(UnknownAtprotoAccountError)
      expect((err as UnknownAtprotoAccountError).toJSON()).toStrictEqual({
        error: 'unknown_atproto_account_error',
        error_description: 'Unknown Atmosphere identity bob.test',
        identifier: 'bob.test',
        issuer: undefined,
      })
    })

    it('reports an unknown identity when resolution fails', async () => {
      const failure = new Error('Unable to resolve identity')
      const { manager } = setup({ resolved: failure })

      const err = await rejectionOf(
        manager.resetPasswordRequest(deviceId, deviceMetadata, {
          locale: 'en',
          identifier: 'bob.test',
        }),
      )

      expect(err).toBeInstanceOf(UnknownAtprotoAccountError)
      const error = err as UnknownAtprotoAccountError
      expect(error.cause).toBe(failure)
      expect(error.toJSON()).toStrictEqual({
        error: 'unknown_atproto_account_error',
        error_description: 'Unknown Atmosphere identity bob.test',
        identifier: 'bob.test',
        issuer: undefined,
      })
    })
  })

  describe('with an email address', () => {
    it.each([
      ['an account matches', alice],
      ['no account matches', null],
    ])(
      'resolves when %s (no user enumeration)',
      async (_label, account) => {
        const { manager, store, hooks, resolver } = setup({ account })
        const input = { locale: 'en', identifier: 'alice@example.com' }

        await expect(
          manager.resetPasswordRequest(deviceId, deviceMetadata, input),
        ).resolves.toBeUndefined()

        expect(store.resetPasswordRequest).toHaveBeenCalledWith(input)
        expect(hooks.onResetPasswordRequest).toHaveBeenCalledWith({
          input,
          deviceId,
          deviceMetadata,
        })
        expect(hooks.onResetPasswordRequested).toHaveBeenCalledWith({
          input,
          deviceId,
          deviceMetadata,
          account,
        })

        expect(store.getAccount).not.toHaveBeenCalled()
        expect(resolver.resolve).not.toHaveBeenCalled()
      },
      // constantTime() pads the email path to 400ms
      2_000,
    )
  })
})
