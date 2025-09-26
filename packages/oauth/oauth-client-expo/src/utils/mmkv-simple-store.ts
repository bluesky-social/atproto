import { Configuration, MMKV } from 'react-native-mmkv'
import type { SimpleStore, Value } from '@atproto-labs/simple-store'

export type MMKVSimpleStoreOptions<V extends Value> = {
  decode: (value: string) => V
  encode: (value: V) => string
}

/**
 * A {@link SimpleStore} implementation using {@link MMKV} for storage.
 */
export class MMKVSimpleStore<V extends Value>
  implements SimpleStore<string, V>
{
  readonly #store: MMKV
  readonly #encode: (value: V) => string
  readonly #decode: (value: string) => V

  constructor({
    decode,
    encode,
    ...config
  }: MMKVSimpleStoreOptions<V> & Configuration) {
    this.#store = new MMKV(config)
    this.#decode = decode
    this.#encode = encode
  }

  set(key: string, value: V): void {
    const encoded = this.#encode.call(null, value)
    this.#store.set(key, encoded)
  }

  get(key: string): V | undefined {
    const value = this.#store.getString(key)
    if (value === undefined) return undefined

    return this.#decode.call(null, value)
  }

  del(key: string): void {
    this.#store.delete(key)
  }

  clear() {
    this.#store.clearAll()
  }
}
