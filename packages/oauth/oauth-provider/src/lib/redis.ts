import { Redis, type RedisOptions } from 'ioredis'

export type { Redis, RedisOptions }

export type CreateRedisOptions = Redis | RedisOptions | string

export function createRedis(options: CreateRedisOptions): Redis {
  if (typeof options === 'string') {
    const url = new URL(
      options.startsWith('redis://') ? options : `redis://${options}`,
    )

    return new Redis({
      host: url.hostname,
      port: parseInt(url.port, 10),
      password: url.password,
    })
  } else if ('on' in options && 'call' in options && 'acl' in options) {
    // Not using "instanceof" here in case the options is an instance of another
    // version of ioredis (Redis is both a class and an interface).
    return options
  } else {
    return new Redis(options)
  }
}
