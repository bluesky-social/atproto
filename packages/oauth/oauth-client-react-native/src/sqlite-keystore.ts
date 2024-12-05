import { SimpleStore } from '@atproto-labs/simple-store'
import { jwkValidator, Key } from '@atproto/jwk'
import { JoseKey } from '@atproto/jwk-jose'
import Storage from 'expo-sqlite/kv-store'

interface HasDPoPKey {
  dpopKey: Key | undefined
}

const NAMESPACE = `@@atproto/oauth-client-react-native`

/**
 * An expo-sqlite store that handles serializing and deserializing
 * our Jose DPoP keys. Wraps SQLiteKVStore or whatever other SimpleStore
 * that a user might provide.
 */
export class JoseKeyStore<T extends HasDPoPKey> {
  private store: SimpleStore<string, string>
  constructor(store: SimpleStore<string, string>) {
    this.store = store
  }

  async get(key: string): Promise<T | undefined> {
    const itemStr = await this.store.get(key)
    if (!itemStr) return undefined
    const item = JSON.parse(itemStr) as T
    if (item.dpopKey) {
      item.dpopKey = new JoseKey(jwkValidator.parse(item.dpopKey))
    }
    return item
  }

  async set(key: string, value: T): Promise<void> {
    if (value.dpopKey) {
      value = {
        ...value,
        dpopKey: (value.dpopKey as JoseKey).privateJwk,
      }
    }
    return await this.store.set(key, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    return await this.store.del(key)
  }
}

/**
 * Simple wrapper around expo-sqlite's KVStore. Default implementation
 * unless a user brings their own KV store.
 */
export class SQLiteKVStore implements SimpleStore<string, string> {
  private namespace: string
  constructor(namespace: string) {
    this.namespace = `${NAMESPACE}:${namespace}`
  }

  async get(key: string): Promise<string | undefined> {
    return (await Storage.getItem(`${this.namespace}:${key}`)) ?? undefined
  }

  async set(key: string, value: string): Promise<void> {
    return await Storage.setItem(`${this.namespace}:${key}`, value)
  }

  async del(key: string): Promise<void> {
    return await Storage.removeItem(`${this.namespace}:${key}`)
  }
}
