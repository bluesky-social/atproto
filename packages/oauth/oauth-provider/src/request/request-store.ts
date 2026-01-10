import { InvalidGrantError } from '../errors/invalid-grant-error.js'
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
  'sub' | 'code' | 'deviceId' | 'expiresAt' | 'parameters'
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
  'createRequest',
  'readRequest',
  'updateRequest',
  'deleteRequest',
  'consumeRequestCode',
])

export function asRequestStore<V extends Partial<RequestStore>>(
  implementation?: V,
): V & RequestStore {
  if (!implementation || !isRequestStore(implementation)) {
    throw new Error('Invalid RequestStore implementation')
  }
  return implementation
}
