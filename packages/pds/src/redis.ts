import assert from 'node:assert'
import { Redis } from 'ioredis'
import { redisLogger } from './logger'

export const getRedisClient = (host: string, password?: string): Redis => {
  const redisAddr = redisAddressParts(host)
  const redis = new Redis({
    ...redisAddr,
    password,
  })
  redis.on('error', (err) => {
    redisLogger.error({ host, err }, 'redis error')
  })
  return redis
}

export const redisAddressParts = (
  addr: string,
  defaultPort = 6379,
): { host: string; port: number } => {
  const [host, portStr, ...others] = addr.split(':')
  const port = portStr ? parseInt(portStr, 10) : defaultPort
  assert(host && !isNaN(port) && !others.length, `invalid address: ${addr}`)
  return { host, port }
}
