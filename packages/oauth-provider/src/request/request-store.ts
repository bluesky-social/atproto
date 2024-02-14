import { Awaitable } from '../util/awaitable.js'
import { Code } from './code.js'
import { RequestData } from './request-data.js'
import { RequestId } from './request-id.js'

// Export all types needed to implement the RequestStore interface
export type { Awaitable, Code, RequestData, RequestId }
export type UpdateRequestData = Pick<
  Partial<RequestData>,
  'sub' | 'code' | 'deviceId' | 'expiresAt'
>

export type FoundRequestResult = {
  id: RequestId
  data: RequestData
}

export interface RequestStore {
  createRequest(id: RequestId, data: RequestData): Awaitable<void>
  readRequest(id: RequestId): Awaitable<RequestData | null>
  updateRequest(id: RequestId, data: UpdateRequestData): Awaitable<void>
  deleteRequest(id: RequestId): void | Awaitable<void>
  findRequestByCode(code: Code): Awaitable<FoundRequestResult | null>
}

export function isRequestStore(
  implementation: Record<string, unknown> & Partial<RequestStore>,
): implementation is Record<string, unknown> & RequestStore {
  return (
    typeof implementation.createRequest === 'function' &&
    typeof implementation.readRequest === 'function' &&
    typeof implementation.updateRequest === 'function' &&
    typeof implementation.deleteRequest === 'function' &&
    typeof implementation.findRequestByCode === 'function'
  )
}
