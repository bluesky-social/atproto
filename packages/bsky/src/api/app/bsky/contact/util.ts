import { MethodNotImplementedError } from '@atproto/xrpc-server'
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
