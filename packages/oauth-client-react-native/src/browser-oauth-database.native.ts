import { GenericStore, Value } from '@atproto/caching'
import { DidDocument } from '@atproto/did'
import { ResolvedHandle } from '@atproto/handle-resolver'
import { Key } from '@atproto/jwk'
import { WebcryptoKey } from '@atproto/jwk-react-native-crypto'
import { InternalStateData, Session, TokenSet } from '@atproto/oauth-client'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'
import Storage from '@react-native-async-storage/async-storage'

type Item<V> = {
  value: V
  expiresAt: null | number
}

type EncodedKey = {
  keyId: string
  keyPair: CryptoKeyPair
}

function encodeKey(key: Key): EncodedKey {
  if (!(key instanceof WebcryptoKey) || !key.kid) {
    throw new Error('Invalid key object')
  }
  return {
    keyId: key.kid,
    keyPair: key.cryptoKeyPair,
  }
}

async function decodeKey(encoded: EncodedKey): Promise<Key> {
  return WebcryptoKey.fromKeypair(encoded.keyId, encoded.keyPair)
}

export type PopupStateData =
  | PromiseRejectedResult
  | PromiseFulfilledResult<{
      sessionId: string
    }>

export type Schema = {
  popup: Item<PopupStateData>
  state: Item<{
    dpopKey: EncodedKey

    iss: string
    nonce: string
    verifier?: string
    appState?: string
  }>
  session: Item<{
    dpopKey: EncodedKey

    tokenSet: TokenSet
  }>

  didCache: Item<DidDocument>
  dpopNonceCache: Item<string>
  handleCache: Item<ResolvedHandle>
  metadataCache: Item<OAuthServerMetadata>
}

export type DatabaseStore<V extends Value> = GenericStore<string, V> & {
  getKeys: () => Promise<string[]>
}

const STORES = [
  'popup',
  'state',
  'session',

  'didCache',
  'dpopNonceCache',
  'handleCache',
  'metadataCache',
] as const

export type BrowserOAuthDatabaseOptions = {
  name?: string
  durability?: 'strict' | 'relaxed'
  cleanupInterval?: number
}

export class BrowserOAuthDatabase {
  #cleanupInterval?: ReturnType<typeof setInterval>

  constructor(options?: BrowserOAuthDatabaseOptions) {
    this.#cleanupInterval = setInterval(() => {
      void this.cleanup()
    }, options?.cleanupInterval ?? 30e3)
  }

  delete = async (key: string) => {
    await Storage.removeItem(key)
    await Storage.removeItem(`${key}.expiresAt`)
  }

  protected createStore<N extends keyof Schema, V extends Value>(
    name: N,
    {
      encode,
      decode,
      expiresAt,
    }: {
      encode: (value: V) => Schema[N]['value'] | PromiseLike<Schema[N]['value']>
      decode: (encoded: Schema[N]['value']) => V | PromiseLike<V>
      expiresAt: (value: V) => null | number
    },
  ): DatabaseStore<V> {
    return {
      get: async (key) => {
        // Find item in store
        const item = await Storage.getItem(`${name}.${key}`)

        // Not found
        if (item === undefined) return undefined

        // Too old (delete)
        const expiresAt = await Storage.getItem(`${name}.${key}.expiresAt`)
        if (expiresAt && Number(expiresAt) < Date.now()) {
          await this.delete(`${name}.${key}`)
          return undefined
        }

        // Item found and valid. Decode
        return decode(item)
      },

      getKeys: async () => {
        const keys = await Storage.getAllKeys()
        return keys.filter((key) => key.startsWith(`${name}.`))
      },

      set: async (key, value) => {
        const encoded = await encode(value)
        const _expiresAt = expiresAt(value)

        await Storage.setItem(`${name}.${key}`, encoded as string)
        if (_expiresAt != null) {
          await Storage.setItem(
            `${name}.${key}.expiresAt`,
            _expiresAt.toString(),
          )
        }
      },
      del: async (key) => {
        await this.delete(`${name}.${key}`)
      },
    }
  }

  getSessionStore(): DatabaseStore<Session> {
    return this.createStore('session', {
      expiresAt: ({ tokenSet }) =>
        tokenSet.refresh_token ? null : tokenSet.expires_at ?? null,
      encode: ({ dpopKey, ...session }) => ({
        ...session,
        dpopKey: encodeKey(dpopKey),
      }),
      decode: async ({ dpopKey, ...encoded }) => ({
        ...encoded,
        dpopKey: await decodeKey(dpopKey),
      }),
    })
  }

  getStateStore(): DatabaseStore<InternalStateData> {
    return this.createStore('state', {
      expiresAt: (_value) => Date.now() + 10 * 60e3,
      encode: ({ dpopKey, ...session }) => ({
        ...session,
        dpopKey: encodeKey(dpopKey),
      }),
      decode: async ({ dpopKey, ...encoded }) => ({
        ...encoded,
        dpopKey: await decodeKey(dpopKey),
      }),
    })
  }

  getPopupStore(): DatabaseStore<PopupStateData> {
    return this.createStore('popup', {
      expiresAt: (_value) => Date.now() + 600e3,
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getDpopNonceCache(): undefined | DatabaseStore<string> {
    return this.createStore('dpopNonceCache', {
      expiresAt: (_value) => Date.now() + 600e3,
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getDidCache(): undefined | DatabaseStore<DidDocument> {
    return this.createStore('didCache', {
      expiresAt: (_value) => Date.now() + 60e3,
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getHandleCache(): undefined | DatabaseStore<ResolvedHandle> {
    return this.createStore('handleCache', {
      expiresAt: (_value) => Date.now() + 60e3,
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getMetadataCache(): undefined | DatabaseStore<OAuthServerMetadata> {
    return this.createStore('metadataCache', {
      expiresAt: (_value) => Date.now() + 60e3,
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  async cleanup() {
    for (const name of STORES) {
      const keys = await Storage.getAllKeys()
      for (const key of keys) {
        if (key.startsWith(`${name}.`)) {
          const expiresAt = await Storage.getItem(`${name}.${key}.expiresAt`)
          if (expiresAt && Number(expiresAt) < Date.now()) {
            await Storage.removeItem(key)
            await Storage.removeItem(`${name}.${key}.expiresAt`)
          }
        }
      }
    }
  }

  async [Symbol.asyncDispose]() {
    clearInterval(this.#cleanupInterval)
  }
}
