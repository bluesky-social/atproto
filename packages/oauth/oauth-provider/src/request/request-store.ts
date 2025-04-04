import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import { Code } from './code.js'
import { RequestData } from './request-data.js'
import { RequestId } from './request-id.js'

// Export all types needed to implement the RequestStore interface
export * from './code.js'
export * from './request-data.js'
export * from './request-id.js'
export type { Awaitable }

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
  /**
   * Note that expired requests **can** be returned to yield a different error
   * message than if the request was not found.
   */
  readRequest(id: RequestId): Awaitable<RequestData | null>
  updateRequest(id: RequestId, data: UpdateRequestData): Awaitable<void>
  deleteRequest(id: RequestId): void | Awaitable<void>
  findRequestByCode(code: Code): Awaitable<FoundRequestResult | null>
}

export const isRequestStore = buildInterfaceChecker<RequestStore>([
  'createRequest',
  'readRequest',
  'updateRequest',
  'deleteRequest',
  'findRequestByCode',
])

export function ifRequestStore<V extends Partial<RequestStore>>(
  implementation?: V,
): (V & RequestStore) | undefined {
  if (implementation && isRequestStore(implementation)) {
    return implementation
  }

  return undefined
}
