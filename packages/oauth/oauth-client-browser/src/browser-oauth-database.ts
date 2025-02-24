import { DidDocument } from '@atproto/did'
import { Key } from '@atproto/jwk'
import { WebcryptoKey } from '@atproto/jwk-webcrypto'
import { InternalStateData, Session, TokenSet } from '@atproto/oauth-client'
import {
  OAuthAuthorizationServerMetadata,
  OAuthProtectedResourceMetadata,
} from '@atproto/oauth-types'
import { ResolvedHandle } from '@atproto-labs/handle-resolver'
import { SimpleStore, Value } from '@atproto-labs/simple-store'
import { DB, DBObjectStore } from './indexed-db/index.js'
import { TupleUnion } from './util.js'

type Item<V> = {
  value: V
  expiresAt?: string // ISO Date
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
  return WebcryptoKey.fromKeypair(encoded.keyPair, encoded.keyId)
}

export type Schema = {
  state: Item<{
    dpopKey: EncodedKey

    iss: string
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
  authorizationServerMetadataCache: Item<OAuthAuthorizationServerMetadata>
  protectedResourceMetadataCache: Item<OAuthProtectedResourceMetadata>
}

export type DatabaseStore<V extends Value> = SimpleStore<string, V>

const STORES: TupleUnion<keyof Schema> = [
  'state',
  'session',

  'didCache',
  'dpopNonceCache',
  'handleCache',
  'authorizationServerMetadataCache',
  'protectedResourceMetadataCache',
]

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
      expiresAt: (value: V) => null | Date
    },
  ): DatabaseStore<V> {
    return {
      get: async (key) => {
        // Find item in store
        const item = await this.run(name, 'readonly', (store) => store.get(key))

        // Not found
        if (item === undefined) return undefined

        // Too old (delete)
        if (item.expiresAt != null && new Date(item.expiresAt) < new Date()) {
          await this.run(name, 'readwrite', (store) => store.delete(key))
          return undefined
        }

        // Item found and valid. Decode
        return decode(item.value)
      },

      set: async (key, value) => {
        // Create encoded item record
        const item = {
          value: await encode(value),
          expiresAt: expiresAt(value)?.toISOString(),
        } as Schema[N]

        // Store item record
        await this.run(name, 'readwrite', (store) => store.put(item, key))
      },

      del: async (key) => {
        // Delete
        await this.run(name, 'readwrite', (store) => store.delete(key))
      },
    }
  }

  getSessionStore(): DatabaseStore<Session> {
    return this.createStore('session', {
      expiresAt: ({ tokenSet }) =>
        tokenSet.refresh_token || tokenSet.expires_at == null
          ? null
          : new Date(tokenSet.expires_at),
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
      expiresAt: (_value) => new Date(Date.now() + 10 * 60e3),
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

  getDpopNonceCache(): undefined | DatabaseStore<string> {
    return this.createStore('dpopNonceCache', {
      expiresAt: (_value) => new Date(Date.now() + 600e3),
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getDidCache(): undefined | DatabaseStore<DidDocument> {
    return this.createStore('didCache', {
      expiresAt: (_value) => new Date(Date.now() + 60e3),
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getHandleCache(): undefined | DatabaseStore<ResolvedHandle> {
    return this.createStore('handleCache', {
      expiresAt: (_value) => new Date(Date.now() + 60e3),
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getAuthorizationServerMetadataCache():
    | undefined
    | DatabaseStore<OAuthAuthorizationServerMetadata> {
    return this.createStore('authorizationServerMetadataCache', {
      expiresAt: (_value) => new Date(Date.now() + 60e3),
      encode: (value) => value,
      decode: (encoded) => encoded,
    })
  }

  getProtectedResourceMetadataCache():
    | undefined
    | DatabaseStore<OAuthProtectedResourceMetadata> {
    return this.createStore('protectedResourceMetadataCache', {
      expiresAt: (_value) => new Date(Date.now() + 60e3),
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
    this.#cleanupInterval = undefined

    const dbPromise = this.#dbPromise
    this.#dbPromise = Promise.reject(new Error('Database has been disposed'))

    // Avoid "unhandled promise rejection"
    this.#dbPromise.catch(() => null)

    // Spec recommends not to throw errors in dispose
    const db = await dbPromise.catch(() => null)
    if (db) await (db[Symbol.asyncDispose] || db[Symbol.dispose]).call(db)
  }
}
