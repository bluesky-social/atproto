import type { Redis } from 'ioredis'
import {
  Awaitable,
  GetOptions,
  SimpleStore,
  Value,
} from '@atproto-labs/simple-store'

export type { Awaitable, GetOptions, SimpleStore, Value }

export type Encoder<K extends string, V extends Value> = (
  value: V,
  key: K,
) => Awaitable<string>
export type Decoder<K extends string, V extends Value> = (
  value: string,
  key: K,
) => Awaitable<V>

export const defaultEncoder: Encoder<any, Value> = (value) =>
  JSON.stringify(value)
export const defaultDecoder: Decoder<any, Value> = (value) => JSON.parse(value)

export type SimpleStoreRedisOptions<K extends string, V extends Value> = {
  keyPrefix: string
  /** In milliseconds */
  ttl?: number
  /** @default JSON.stringify */
  encode?: Encoder<K, V>
  /** @default JSON.parse */
  decode?: Decoder<K, V>
}

export class SimpleStoreRedis<K extends string, V extends Value>
  implements SimpleStore<K, V>
{
  constructor(
    protected readonly redis: Redis,
    protected readonly options: SimpleStoreRedisOptions<K, V>,
  ) {
    if (!options.keyPrefix) {
      throw new TypeError(`keyPrefix must be a non-empty string`)
    }
    if (options.ttl != null && options.ttl <= 0) {
      throw new TypeError(`ttl must be greater than 0`)
    }
  }

  protected encodeKey(key: K): string {
    return `${this.options.keyPrefix}${key satisfies string}`
  }

  async get(key: K, options?: GetOptions): Promise<V | undefined> {
    const eKey = this.encodeKey(key)
    const eValue = await this.redis.get(eKey)
    if (eValue == null) return undefined
    options?.signal?.throwIfAborted()
    const { decode = defaultDecoder as Decoder<any, V> } = this.options
    return decode(eValue, key)
  }

  async set(key: K, value: V): Promise<void> {
    const eKey = this.encodeKey(key)
    const { encode = defaultEncoder, ttl } = this.options
    const eValue = await encode(value, key)
    if (ttl) await this.redis.set(eKey, eValue, 'PX', ttl)
    else await this.redis.set(eKey, eValue)
  }

  async del(key: K): Promise<void> {
    const eKey = this.encodeKey(key)
    await this.redis.del(eKey)
  }
}
