import type { Redis } from 'ioredis'

import { CreateRedisOptions, createRedis } from '../lib/redis.js'
import { Code } from './code.js'
import { RequestData } from './request-data.js'
import { RequestId, requestIdSchema } from './request-id.js'
import { RequestStore } from './request-store.js'

export type { Redis, CreateRedisOptions }

export type ReplayStoreRedisOptions = {
  redis: CreateRedisOptions
}

export class RequestStoreRedis implements RequestStore {
  private readonly redis: Redis

  constructor(options: ReplayStoreRedisOptions) {
    this.redis = createRedis(options.redis)
  }

  async readRequest(id: RequestId): Promise<RequestData | null> {
    const data = await this.redis.get(id)
    return data ? JSON.parse(data) : null
  }

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    const timeFrame = data.expiresAt.getTime() - Date.now()
    await this.redis.set(id, JSON.stringify(data), 'PX', timeFrame)
    if (data.code) await this.redis.set(data.code, id, 'PX', timeFrame)
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
    const data = await this.readRequest(id)
    if (!data) return
    if (data.code) await this.redis.del(data.code)
    await this.redis.del(id)
  }

  private async findRequestIdByCode(code: Code): Promise<RequestId | null> {
    const value = await this.redis.get(code)
    if (!value) return null

    const parsed = requestIdSchema.safeParse(value)
    if (!parsed.success) return null

    return parsed.data
  }

  async findRequestByCode(
    code: Code,
  ): Promise<{ id: RequestId; data: RequestData } | null> {
    const id = await this.findRequestIdByCode(code)
    if (!id) return null

    const data = await this.readRequest(id)
    if (!data) return null

    return { id, data }
  }
}
