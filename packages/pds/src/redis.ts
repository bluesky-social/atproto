import assert from 'node:assert'
import { Redis } from 'ioredis'
import { redisLogger } from './logger.js'

export const REDIS_COMMAND_TIMEOUT_MS = 500

export const getRedisClient = (host: string, password?: string): Redis => {
  const redisAddr = redisAddressParts(host)
  const redis = new Redis({
    ...redisAddr,
    password,
    // Redis holds scratch state only (rate-limit counters, DPoP replay
    // records, a scope cache), and every use of it fails open. Fail commands
    // fast rather than queue them while disconnected or wait on a Redis that
    // doesn't answer, so an outage costs a request at most this much time.
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    enableOfflineQueue: false,
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
