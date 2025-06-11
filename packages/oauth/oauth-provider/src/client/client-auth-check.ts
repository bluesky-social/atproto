import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationRequestParameters,
} from '@atproto/oauth-types'
import { DpopProof } from '../dpop/dpop-proof.js'
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
  dpopProof: null | DpopProof,
  initial: {
    parameters: OAuthAuthorizationRequestParameters
    clientId: ClientId
    clientAuth: null | ClientAuth | ClientAuthLegacy
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

  const { parameters } = initial
  if (parameters.dpop_jkt) {
    if (!dpopProof) {
      throw new InvalidGrantError(`DPoP proof is required for this request`)
    } else if (parameters.dpop_jkt !== dpopProof.jkt) {
      throw new InvalidGrantError(`DPoP proof does not match the expected JKT`)
    }
  }

  if (!initial.clientAuth) {
    // If the client did not use PAR, it was not authenticated when the request
    // was initially created (see authorize() method in OAuthProvider). Since
    // PAR is not mandatory, and since the token exchange currently taking place
    // *is* authenticated (`clientAuth`), we allow "upgrading" the
    // authentication method (the token created will be bound to the current
    // clientAuth).
    return
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
