import { Redis, type RedisOptions } from 'ioredis'

export type { Redis, RedisOptions }

export type CreateRedisOptions = Redis | RedisOptions | string

export function createRedis(options: CreateRedisOptions): Redis {
  if (options instanceof Redis) {
    return options
  } else if (typeof options === 'string') {
    const url = new URL(
      options.startsWith('redis://') ? options : `redis://${options}`,
    )

    return new Redis({
      host: url.hostname,
      port: parseInt(url.port, 10),
      password: url.password,
    })
  } else {
    return new Redis(options)
  }
}
