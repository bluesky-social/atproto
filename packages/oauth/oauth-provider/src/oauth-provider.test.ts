import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  AccessTokenMode,
  JoseKey,
  Keyset,
  OAuthProvider,
} from './oauth-provider.js'

// A store whose every method is a no-op, optionally omitting some methods.
function createStore(omit: string[] = []) {
  return new Proxy(
    {},
    {
      has: (_, key) => typeof key === 'string' && !omit.includes(key),
      get: (_, key) =>
        typeof key === 'string' && !omit.includes(key)
          ? async () => undefined
          : undefined,
    },
  )
}

async function createProvider(store: object, options: object = {}) {
  const keyset = new Keyset([
    await JoseKey.fromKeyLike(crypto.randomBytes(32), 'k1', 'HS256'),
  ])
  return new OAuthProvider({
    store: store as never,
    issuer: 'https://bsky.social',
    keyset,
    safeFetch: globalThis.fetch,
    accessTokenMode: AccessTokenMode.stateless,
    ...options,
  })
}

describe('OAuthProvider fedcm account signer check', () => {
  it('throws when FedCM is enabled and the account store has no getAccountSigner', async () => {
    await expect(
      createProvider(createStore(['getAccountSigner']), { fedcm: {} }),
    ).rejects.toThrow(/getAccountSigner/)
    await expect(
      createProvider(createStore(['getAccountSigner']), { fedcm: {} }),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('accepts FedCM when the account store has getAccountSigner', async () => {
    await expect(
      createProvider(createStore(), { fedcm: {} }),
    ).resolves.toBeInstanceOf(OAuthProvider)
  })

  it('does not require getAccountSigner when FedCM is disabled', async () => {
    await expect(
      createProvider(createStore(['getAccountSigner'])),
    ).resolves.toBeInstanceOf(OAuthProvider)
  })
})
