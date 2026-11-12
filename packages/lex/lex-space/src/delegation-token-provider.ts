import { type Agent, isAuthenticatedAgent, xrpc } from '@atproto/lex-client'
import type { SpaceRef } from '@atproto/syntax'
import getDelegationToken from './lexicons/com/atproto/space/getDelegationToken.js'

/**
 * Provides the delegation token, issued by the PDS of a user the space grants
 * read access to, to exchange for a space credential. Resolves `undefined` for
 * spaces with public read access.
 */
export type DelegationTokenProvider = (
  space: SpaceRef,
  options: { signal?: AbortSignal },
) => Promise<string | undefined>

/**
 * Provides delegation tokens issued, by their PDS, for the user of `agent`.
 * Requires the user's session to hold a `read` grant on the space.
 *
 * @throws {TypeError} if `agent` is not authenticated
 *
 * @example
 * ```typescript
 * const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
 *   delegationTokenProvider: delegationTokenProviderFor(client.agent),
 * })
 * ```
 */
export function delegationTokenProviderFor(
  agent: Agent,
): DelegationTokenProvider {
  if (!isAuthenticatedAgent(agent)) {
    throw new TypeError('Agent must be authenticated')
  }
  return async (space, { signal }) => {
    const res = await xrpc(agent, getDelegationToken, {
      signal,
      params: { space: space.toString() },
    })
    return res.body.token
  }
}
