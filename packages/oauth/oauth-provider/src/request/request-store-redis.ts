import type { Redis, RedisKey } from 'ioredis'
import { CreateRedisOptions, createRedis } from '../lib/redis.js'
import { Code } from './code.js'
import { RequestData } from './request-data.js'
import { RequestId, requestIdSchema } from './request-id.js'
import { RequestStore } from './request-store.js'

export type { CreateRedisOptions, Redis }

export type ReplayStoreRedisOptions = {
  redis: CreateRedisOptions
}

export class RequestStoreRedis implements RequestStore {
  private readonly redis: Redis

  constructor(options: ReplayStoreRedisOptions) {
    this.redis = createRedis(options.redis)
  }

  async readRequest(id: RequestId): Promise<RequestData | null> {
    const value = await this.redis.get(id)
    return value ? decode(value) : null
  }

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    const values: [RedisKey, string][] = [[id, encode(data)]]
    if (data.code) values.push([data.code, id])

    // Using MSET to atomically set all values at once
    await this.redis.mset(values)

    // MSET does not support expiration, so we set it manually
    for (const [key] of values) {
      await this.redis.pexpireat(key, data.expiresAt.getTime())
    }
  }

  async updateRequest(
    id: RequestId,
    updates: Partial<RequestData>,
  ): Promise<void> {
    const prevData = await this.redis.getdel(id).then(decode)
    if (!prevData) throw new Error('Request not found')

    const nextData = { ...prevData, ...updates }
    await this.createRequest(id, nextData)

    // Remove the old code index if it has changed
    if (prevData.code && prevData.code !== nextData.code) {
      await this.redis.del(prevData.code)
    }
  }

  async deleteRequest(id: RequestId): Promise<void> {
    // Using GETDEL to avoid un-necessary round trips
    const data = await this.redis.getdel(id).then(decode)

    // Also delete the "code" index
    if (data?.code) await this.redis.del(data.code)
  }

  async consumeRequestCode(
    code: Code,
  ): Promise<{ id: RequestId; data: RequestData } | null> {
    // In order to prevent using the same code twice concurrently,
    // we use getdel to atomically retrieve and delete the code.

    const value = await this.redis.getdel(code)
    if (!value) return null

    const parsed = requestIdSchema.safeParse(value)
    if (!parsed.success) return null

    const id: RequestId = parsed.data

    // Also delete the request entry itself (see consumeRequestCode's interface)
    const data = await this.redis.getdel(id).then(decode)

    // Protect against concurrent updates
    if (data?.code !== code) return null

    return { id, data }
  }
}

function encode(value: RequestData): string {
  return JSON.stringify(value)
}

function decode(value: string): RequestData
function decode(value?: null): null
function decode(value?: string | null): RequestData | null
function decode(value?: string | null): RequestData | null {
  if (value == null) return null
  return JSON.parse(value) as RequestData
}
