import { ConnectError } from '@connectrpc/connect'
import {
  MethodNotImplementedError,
  InvalidRequestError,
  InternalServerError,
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
      const error = e.details?.at(0) as
        | {
            debug: {
              reason: string
              message: string
            }
          }
        | undefined

      const reason = error?.debug?.reason
      const message = error?.debug?.message

      // Handle known error reasons
      if (reason) {
        if (reason === 'INTERNAL_ERROR') {
          throw new InternalServerError('Upstream error', 'INTERNAL_ERROR', {
            cause: e,
          })
        } else {
          throw new InvalidRequestError(
            message ?? 'An error occurred',
            reason, // should match Rolodex error codes
            {
              cause: e,
            },
          )
        }
      }
    }

    throw e
  }
}
