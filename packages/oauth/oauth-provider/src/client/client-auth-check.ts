import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from '@atproto/oauth-types'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { ClientAuth } from './client-auth.js'
import { ClientId } from './client-id.js'
import { Client } from './client.js'

/**
 * Ensures that a {@link ClientAuth} used by a current request matches a
 * {@link previous} authentication method currently.
 */
export function clientAuthCheck<C extends ClientAuth>(
  client: Client,
  clientAuth: C,
  previous: {
    clientId: ClientId
    clientAuth: ClientAuth
  },
): asserts previous is { clientId: ClientId; clientAuth: C } {
  if (previous.clientId !== client.id) {
    throw new InvalidGrantError(`Token was not issued to this client`)
  }

  switch (previous.clientAuth.method) {
    case CLIENT_ASSERTION_TYPE_JWT_BEARER: // LEGACY
    case 'private_key_jwt':
      if (
        clientAuth.method !== CLIENT_ASSERTION_TYPE_JWT_BEARER && // LEGACY
        clientAuth.method !== 'private_key_jwt'
      ) {
        throw new InvalidGrantError(
          `Client authentication method mismatch (expected ${previous.clientAuth.method})`,
        )
      }
      if (
        clientAuth.kid !== previous.clientAuth.kid ||
        clientAuth.alg !== previous.clientAuth.alg ||
        clientAuth.jkt !== previous.clientAuth.jkt
      ) {
        throw new InvalidGrantError(
          `The session was initiated with a different key than the client assertion currently used`,
        )
      }
      break
    case 'none':
      if (clientAuth.method !== previous.clientAuth.method) {
        throw new InvalidGrantError(
          `Client authentication method mismatch (expected ${previous.clientAuth.method})`,
        )
      }
      break
    default:
      throw new InvalidGrantError(
        // @ts-expect-error (future proof, backwards compatibility)
        `Invalid method "${previous.clientAuth.method}"`,
      )
  }
}
