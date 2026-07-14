import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import type { Awaitable } from '../lib/util/type.js'
import { buildInterfaceChecker } from '../lib/util/type.js'
import type { Code } from './code.js'
import type { RequestData } from './request-data.js'
import type { RequestId } from './request-id.js'

// Export all types needed to implement the RequestStore interface
export type * from './request-data.js'
export type { Awaitable, RequestId }

export type UpdateRequestData = Pick<
  Partial<RequestData>,
  'did' | 'code' | 'deviceId' | 'expiresAt' | 'parameters'
>

export type FoundRequestResult = {
  requestId: RequestId
  data: RequestData
}

export { InvalidGrantError }

export interface RequestStore {
  createRequest(requestId: RequestId, data: RequestData): Awaitable<void>
  /**
   * Note that expired requests **can** be returned to yield a different error
   * message than if the request was not found.
   */
  readRequest(requestId: RequestId): Awaitable<RequestData | null>
  updateRequest(requestId: RequestId, data: UpdateRequestData): Awaitable<void>
  deleteRequest(requestId: RequestId): void | Awaitable<void>
  /**
   * @note it is **IMPORTANT** that this method prevents concurrent retrieval of
   * the same code. If two requests are made with the same code, only one of
   * them should succeed and return the request data.
   *
   * @throws {InvalidGrantError} - When the request is not found or has expired
   * (allows to provide an error message instead of returning `null`).
   */
  consumeRequestCode(code: Code): Awaitable<FoundRequestResult | null>
}

export const isRequestStore = buildInterfaceChecker<RequestStore>([
  'consumeRequestCode',
  'createRequest',
  'deleteRequest',
  'readRequest',
  'updateRequest',
])

export function asRequestStore<V extends Partial<RequestStore>>(
  implementation?: V,
): V & RequestStore {
  if (!implementation || !isRequestStore(implementation)) {
    throw new Error('Invalid RequestStore implementation')
  }
  return implementation
}
