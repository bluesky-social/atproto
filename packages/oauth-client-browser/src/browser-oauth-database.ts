import { GenericStore, Value } from '@atproto/caching'
import { DidDocument } from '@atproto/did'
import { ResolvedHandle } from '@atproto/handle-resolver'
import { DB, DBObjectStore } from '@atproto/indexed-db'
import { Key } from '@atproto/jwk'
import { WebcryptoKey } from '@atproto/jwk-webcrypto'
import { InternalStateData, Session, TokenSet } from '@atproto/oauth-client'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'

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
  | PromiseFulfilledResult<string>

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
  #dbPromise: Promise<DB<Schema>>
  #cleanupInterval?: ReturnType<typeof setInterval>

  constructor(options?: BrowserOAuthDatabaseOptions) {
    this.#dbPromise = DB.open<Schema>(
      options?.name ?? '@atproto-oauth-client',
      [
        (db) => {
          for (const name of STORES) {
            const store = db.createObjectStore(name, { autoIncrement: true })
            store.createIndex('expiresAt', 'expiresAt', { unique: false })
          }
        },
      ],
      { durability: options?.durability ?? 'strict' },
    )

    this.#cleanupInterval = setInterval(() => {
      void this.cleanup()
    }, options?.cleanupInterval ?? 30e3)
  }

  protected async run<N extends keyof Schema, R>(
    storeName: N,
    mode: 'readonly' | 'readwrite',
    fn: (s: DBObjectStore<Schema[N]>) => R | Promise<R>,
  ): Promise<R> {
    const db = await this.#dbPromise
    return await db.transaction([storeName], mode, (tx) =>
      fn(tx.objectStore(storeName)),
    )
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
        const item = await this.run(name, 'readonly', (dbStore) => {
          return dbStore.get(key)
        })

        console.error('GOT item', key, item)

        // Not found
        if (item === undefined) return undefined

        // Too old, proactively delete
        if (item.expiresAt != null && item.expiresAt < Date.now()) {
          await this.run(name, 'readwrite', (dbStore) => {
            return dbStore.delete(key)
          })
          return undefined
        }

        // Item found and valid. Decode
        return decode(item.value)
      },

      getKeys: async () => {
        const keys = await this.run(name, 'readonly', (dbStore) => {
          return dbStore.getAllKeys()
        })
        return keys.filter((key) => typeof key === 'string') as string[]
      },

      set: async (key, value) => {
        // Create encoded item record
        const item = {
          value: await encode(value),
          expiresAt: expiresAt(value),
        } as Schema[N]

        // Store item record
        await this.run(name, 'readwrite', (dbStore) => {
          return dbStore.put(item, key)
        })
      },

      del: async (key) => {
        // Delete
        await this.run(name, 'readwrite', (dbStore) => {
          return dbStore.delete(key)
        })
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
      expiresAt: (_value) => Date.now() + 600e3,
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
    const db = await this.#dbPromise

    for (const name of STORES) {
      await db.transaction([name], 'readwrite', (tx) =>
        tx
          .objectStore(name)
          .index('expiresAt')
          .deleteAll(IDBKeyRange.upperBound(Date.now())),
      )
    }
  }

  async [Symbol.asyncDispose]() {
    clearInterval(this.#cleanupInterval)
    const dbPromise = this.#dbPromise
    this.#dbPromise = Promise.reject(new Error('Database has been disposed'))

    const db = await dbPromise
    await (db[Symbol.asyncDispose] || db[Symbol.dispose]).call(db)
  }
}
