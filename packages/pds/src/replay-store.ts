import type { Redis } from 'ioredis'
import type { ReplayStore } from '@atproto/oauth-provider/store'
import { oauthLogger } from './logger.js'

const WARN_INTERVAL_MS = 10_000

/**
 * Replay detection for DPoP proofs and client assertions on the scratch Redis
 * that never fails a request because of Redis. Each process also keeps its own
 * history: a nonce either has seen is a replay, so while Redis is down replays
 * within a process are still refused (across processes they aren't), including
 * replays of proofs first seen before Redis failed or after it recovered. Keys
 * match `ReplayStoreRedis`, so switching to this store keeps the records
 * already in Redis.
 */
export class FailOpenReplayStore implements ReplayStore {
  private readonly memory = new Map<string, number>()
  private lastCleanup = Date.now()
  private lastWarn = 0

  constructor(private readonly redis: Redis) {}

  async unique(
    namespace: string,
    nonce: string,
    timeFrame: number,
  ): Promise<boolean> {
    const key = `nonces:${namespace}:${nonce}`
    const local = this.uniqueInMemory(key, timeFrame)
    try {
      const prev = await this.redis.set(key, '1', 'PX', timeFrame, 'GET')
      return prev == null && local
    } catch (err) {
      this.warn(err)
      return local
    }
  }

  private uniqueInMemory(key: string, timeFrame: number): boolean {
    const now = Date.now()
    if (this.lastCleanup < now - 60_000) {
      for (const [k, expires] of this.memory) {
        if (expires < now) this.memory.delete(k)
      }
      this.lastCleanup = now
    }
    const exp = this.memory.get(key)
    this.memory.set(key, now + timeFrame)
    return exp == null || exp < now
  }

  // One line per interval per process, not one per request, during an outage.
  private warn(err: unknown) {
    const now = Date.now()
    if (now - this.lastWarn < WARN_INTERVAL_MS) return
    this.lastWarn = now
    oauthLogger.warn(
      { err },
      'replay check: redis failed; checking nonces in process memory',
    )
  }
}
