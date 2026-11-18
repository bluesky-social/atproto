import { Redis, type RedisOptions } from 'ioredis'

export type { Redis, RedisOptions }

export type CreateRedisOptions = Redis | RedisOptions | string

// @TODO Pins ioredis 5's wire behavior (RESP2, no CLIENT SETINFO on connect)
// so the ioredis 6 upgrade changes nothing for callers' Redis servers (Redis
// < 7.2 rejects CLIENT SETINFO). Callers can override it through RedisOptions.
// Drop this to use ioredis 6's defaults in the next breaking release.
const REDIS_DEFAULTS = { protocol: 2, disableClientInfo: true } as const

export function createRedis(options: CreateRedisOptions): Redis {
  if (typeof options === 'string') {
    const url = new URL(
      options.startsWith('redis://') ? options : `redis://${options}`,
    )

    return new Redis({
      ...REDIS_DEFAULTS,
      host: url.hostname,
      port: parseInt(url.port, 10),
      password: url.password,
    })
  } else if ('on' in options && 'call' in options && 'acl' in options) {
    // Not using "instanceof" here in case the options is an instance of another
    // version of ioredis (Redis is both a class and an interface).
    return options
  } else {
    return new Redis({ ...REDIS_DEFAULTS, ...options })
  }
}
