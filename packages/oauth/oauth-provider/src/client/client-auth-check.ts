import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from '@atproto/oauth-types'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { ClientAuth, ClientAuthLegacy } from './client-auth.js'
import { ClientId } from './client-id.js'
import { Client } from './client.js'

/**
 * Ensures that a {@link ClientAuth} used by a current request matches a
 * {@link initial} authentication method currently.
 */
export async function validateClientAuth(
  client: Client,
  clientAuth: ClientAuth,
  initial: {
    clientId: ClientId
    clientAuth: ClientAuth | ClientAuthLegacy
  },
): Promise<void> {
  // Fool proofing, ensure that the client is authenticating using the right method
  if (clientAuth.method !== client.metadata.token_endpoint_auth_method) {
    throw new InvalidGrantError(
      `Client authentication method mismatch (expected ${client.metadata.token_endpoint_auth_method}, got ${clientAuth.method})`,
    )
  }

  if (initial.clientId !== client.id) {
    throw new InvalidGrantError(`Token was not issued to this client`)
  }

  switch (initial.clientAuth.method) {
    case CLIENT_ASSERTION_TYPE_JWT_BEARER: // LEGACY
    case 'private_key_jwt':
      if (clientAuth.method !== 'private_key_jwt') {
        throw new InvalidGrantError(
          `Client authentication method mismatch (expected ${initial.clientAuth.method})`,
        )
      }
      if (
        clientAuth.kid !== initial.clientAuth.kid ||
        clientAuth.alg !== initial.clientAuth.alg ||
        clientAuth.jkt !== initial.clientAuth.jkt
      ) {
        throw new InvalidGrantError(
          `The session was initiated with a different key than the client assertion currently used`,
        )
      }
      break
    case 'none':
      // @NOTE We allow the client to "upgrade" to a confidential client if
      // the session was initially created without client authentication.
      break
    default:
      throw new InvalidGrantError(
        // @ts-expect-error (future proof, backwards compatibility)
        `Invalid method "${initial.clientAuth.method}"`,
      )
  }
}
