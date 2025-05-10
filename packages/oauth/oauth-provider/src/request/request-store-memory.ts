import { Code } from './code.js'
import { RequestData } from './request-data.js'
import { RequestId } from './request-id.js'
import { FoundRequestResult, RequestStore } from './request-store.js'

export class RequestStoreMemory implements RequestStore {
  #requests = new Map<RequestId, RequestData>()

  async readRequest(id: RequestId): Promise<RequestData | null> {
    return this.#requests.get(id) ?? null
  }

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    this.#requests.set(id, data)
  }

  async updateRequest(
    id: RequestId,
    data: Partial<RequestData>,
  ): Promise<void> {
    const current = this.#requests.get(id)
    if (!current) throw new Error('Request not found')
    const newData = { ...current, ...data }
    this.#requests.set(id, newData)
  }

  async deleteRequest(id: RequestId): Promise<void> {
    this.#requests.delete(id)
  }

  async findRequestByCode(code: Code): Promise<FoundRequestResult | null> {
    for (const [requestId, data] of this.#requests) {
      if (data.code === code) return { requestId, data }
    }
    return null
  }
}
