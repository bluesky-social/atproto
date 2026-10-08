import type { DidString } from '@atproto/lex'
import { ForbiddenError } from '@atproto/xrpc-server'
import type { AuthVerifier } from '../auth-verifier.js'

/** Resolve a viewer or a staff member's read-only preview of another account. */
export function inboxViewerDid(
  auth: Awaited<ReturnType<AuthVerifier['standard']>>,
  did = auth.credentials.iss,
): DidString {
  const { credentials } = auth
  if (
    did !== credentials.iss &&
    !(credentials.isModerator || credentials.isTriage || credentials.isAdmin)
  ) {
    throw new ForbiddenError('Unauthorized')
  }
  return did
}
