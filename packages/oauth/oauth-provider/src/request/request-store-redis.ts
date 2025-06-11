import type { Redis } from 'ioredis'
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
    if (!value) return null

    const data = decode(value)
    if (!data) await this.redis.del(id)

    return data
  }

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    await this.redis.set(id, encode(data), 'PX', px(data.expiresAt))
    if (data.code) await this.redis.set(data.code, id, 'PX', px(data.expiresAt))
  }

  async updateRequest(
    id: RequestId,
    data: Partial<RequestData>,
  ): Promise<void> {
    const current = await this.readRequest(id)
    if (!current) throw new Error('Request not found')
    if (current.code) await this.redis.del(current.code)
    const newData = { ...current, ...data }
    await this.createRequest(id, newData)
  }

  async deleteRequest(id: RequestId): Promise<void> {
    // Using GETDEL to avoid un-necessary round trips
    const value = await this.redis.getdel(id)
    if (!value) return

    const code = decode(value)?.code
    if (typeof code === 'string') await this.redis.del(code)
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

    const id = parsed.data
    if (!id) return null

    const data = await this.readRequest(id)
    if (!data) return null

    // Also delete the request entry itself
    await this.redis.del(id)

    // Protect against concurrent updates
    if (data.code !== code) return null

    return { id, data }
  }
}

function px(date: Date): number {
  return date.getTime() - Date.now()
}

function encode(value: RequestData): string {
  return JSON.stringify(value)
}

function decode(value: string): RequestData | null {
  try {
    return JSON.parse(value) as RequestData
  } catch {
    return null
  }
}
