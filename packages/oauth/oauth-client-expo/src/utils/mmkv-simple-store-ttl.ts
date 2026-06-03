import { Configuration, MMKV } from 'react-native-mmkv'
import type { SimpleStore, Value } from '@atproto-labs/simple-store'
import { MMKVSimpleStore, MMKVSimpleStoreOptions } from './mmkv-simple-store.js'

export type MMKVSimpleStoreTTLOptions<V extends Value> =
  MMKVSimpleStoreOptions<V> & {
    cleanupInterval?: null | false | number
    expiresAt: (value: V) => null | number
  }

/**
 * A {@link SimpleStore} implementation based on {@link MMKVSimpleStore} that
 * supports expiring entries after a certain time.
 */
export class MMKVSimpleStoreTTL<V extends Value>
  extends MMKVSimpleStore<V>
  implements SimpleStore<string, V>
{
  readonly #store: MMKV
  readonly #expiresAt: (value: V) => null | number
  readonly #cleanupInterval: number | null
  #lastCleanup = 0

  constructor({
    cleanupInterval = 60 * 1e3,
    expiresAt,
    encode,
    decode,

    ...config
  }: MMKVSimpleStoreTTLOptions<V> & Configuration) {
    super({ ...config, encode, decode })

    this.#store = new MMKV({ ...config, id: `${config.id}.exp` })
    this.#expiresAt = expiresAt
    this.#cleanupInterval = cleanupInterval || null
  }

  override set(key: string, value: V): void {
    super.set(key, value)

    const expirationDate = this.#expiresAt.call(null, value)
    if (expirationDate == null) this.#store.delete(key)
    else this.#store.set(key, expirationDate)

    this.maybeClearExpired()
  }

  override get(key: string): V | undefined {
    this.maybeClearExpired()

    if (this.isExpired(key)) {
      this.del(key)
      return undefined
    }

    return super.get(key)
  }

  override del(key: string): void {
    super.del(key)
    this.#store.delete(key)

    this.maybeClearExpired()
  }

  override clear(): void {
    super.clear()
    this.#store.clearAll()
  }

  protected getExpirationTime(key: string): number | undefined {
    return this.#store.getNumber(key) ?? undefined
  }

  protected isExpired(key: string): boolean {
    const expirationTime = this.getExpirationTime(key)
    return expirationTime != null && expirationTime < Date.now()
  }

  protected clearExpired() {
    this.#lastCleanup = Date.now()
    for (const key of this.#store.getAllKeys() ?? []) {
      if (this.isExpired(key)) {
        this.del(key)
      }
    }
  }

  protected maybeClearExpired() {
    if (this.#cleanupInterval == null) return
    if (Date.now() - this.#lastCleanup < this.#cleanupInterval) return
    this.clearExpired()
  }
}
