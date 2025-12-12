import { ConnectError } from '@connectrpc/connect'
import {
  InternalServerError,
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../..'
import { RolodexClient } from '../../../../rolodex'

export function assertRolodexOrThrowUnimplemented(
  ctx: AppContext,
): asserts ctx is AppContext & { rolodexClient: RolodexClient } {
  if (!ctx.rolodexClient) {
    throw new MethodNotImplementedError(
      'This service is not configured to support contact imports.',
    )
  }
}

/**
 * Converts UPPERCASE_ERROR from Rolodex to PascalCase for XRPC.
 */
function convertErrorName(reason: string): string {
  switch (reason) {
    case 'INVALID_DID':
      return 'InvalidDid'
    case 'INVALID_LIMIT':
      return 'InvalidLimit'
    case 'INVALID_CURSOR':
      return 'InvalidCursor'
    case 'INVALID_CONTACTS':
      return 'InvalidContacts'
    case 'TOO_MANY_CONTACTS':
      return 'TooManyContacts'
    case 'INVALID_TOKEN':
      return 'InvalidToken'
    case 'RATE_LIMIT_EXCEEDED':
      return 'RateLimitExceeded'
    case 'INVALID_PHONE':
      return 'InvalidPhone'
    case 'INVALID_CODE':
      return 'InvalidCode'
    case 'INTERNAL_ERROR':
      return 'InternalError'
    default:
      return reason
  }
}

/**
 * Helper to call Rolodex client methods and translate RPC errors to XRPC
 * errors.
 *
 * These `reason` values need to stay in sync with the Rolodex service
 */
export async function callRolodexClient<T>(caller: T) {
  try {
    return await caller
  } catch (e) {
    // might be something we want to handle
    if (e instanceof ConnectError) {
      /**
       * https://connectrpc.com/docs/protocol#error-end-stream
       */
      const details = e.details?.at(0) as
        | {
            debug: {
              reason: string
              message: string
            }
          }
        | undefined
      const reason = details?.debug?.reason // e.g. INVALID_DID
      // Handle known error reasons
      if (reason) {
        const errorName = convertErrorName(reason)
        // NOTE: Don't leak e.message to the response.

        if (reason === 'INTERNAL_ERROR') {
          throw new InternalServerError('Upstream error', errorName, {
            cause: e,
          })
        } else {
          throw new InvalidRequestError('An error occurred', errorName, {
            cause: e,
          })
        }
      }
    }
    throw e
  }
}
