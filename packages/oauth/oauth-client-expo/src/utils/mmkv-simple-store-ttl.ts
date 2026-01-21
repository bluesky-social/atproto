import { Configuration, MMKV } from 'react-native-mmkv'
import type { SimpleStore, Value } from '@atproto-labs/simple-store'
import { MMKVSimpleStore, MMKVSimpleStoreOptions } from './mmkv-simple-store'

export type MMKVSimpleStoreTTLOptions<V extends Value> =
  MMKVSimpleStoreOptions<V> & {
    clearInterval?: null | false | number
    expiresAt: (value: V) => null | number
  }

/**
 * A {@link SimpleStore} implementation based on {@link MMKVSimpleStore} that
 * supports expiring entries after a certain time.
 */
export class MMKVSimpleStoreTTL<V extends Value>
  extends MMKVSimpleStore<V>
  implements Disposable, SimpleStore<string, V>
{
  readonly #store: MMKV
  readonly #expiresAt: (value: V) => null | number
  readonly #clearTimer?: ReturnType<typeof setInterval>

  constructor({
    clearInterval = 60 * 1e3,
    expiresAt,
    encode,
    decode,

    ...config
  }: MMKVSimpleStoreTTLOptions<V> & Configuration) {
    super({ ...config, encode, decode })

    this.#store = new MMKV({ ...config, id: `${config.id}.exp` })
    this.#expiresAt = expiresAt
    if (clearInterval) {
      this.#clearTimer = setInterval(() => this.clearExpired(), clearInterval)
    }

    this.clearExpired()
  }

  [Symbol.dispose]() {
    clearInterval(this.#clearTimer)
    this.clearExpired()
  }

  override set(key: string, value: V): void {
    super.set(key, value)

    const expirationDate = this.#expiresAt.call(null, value)
    if (expirationDate == null) this.#store.delete(key)
    else this.#store.set(key, expirationDate)
  }

  override get(key: string): V | undefined {
    if (this.isExpired(key)) {
      this.del(key)
      return undefined
    }

    return super.get(key)
  }

  override del(key: string): void {
    super.del(key)
    this.#store.delete(key)
  }

  override clear(): void {
    super.clear()
    this.#store.clearAll()
  }

  getExpirationTime(key: string): number | undefined {
    return this.#store.getNumber(key) ?? undefined
  }

  isExpired(key: string): boolean {
    const expirationTime = this.getExpirationTime(key)
    return expirationTime != null && expirationTime < Date.now()
  }

  clearExpired() {
    for (const key of this.#store.getAllKeys() ?? []) {
      if (this.isExpired(key)) {
        this.del(key)
      }
    }
  }
}
