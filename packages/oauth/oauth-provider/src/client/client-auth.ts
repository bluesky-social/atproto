import { KeyLike, calculateJwkThumbprint, exportJWK } from 'jose'
import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from '@atproto/oauth-types'
import { InvalidClientError } from '../errors/invalid-client-error.js'

export type ClientAuth =
  | { method: 'none' }
  | {
      method: typeof CLIENT_ASSERTION_TYPE_JWT_BEARER

      /**
       * Algorithm used for client authentication.
       *
       * @note We could allow clients to use a different algorithm over time
       * (e.g. because new safer algorithms become available). For now, we
       * require that the algorithm remains the same, as it is a bad practice to
       * use the same key for different purposes.
       */
      alg: string

      /**
       * ID of the key that was used for client authentication.
       *
       * @note The most important thing to validate is that the actual key didn't change (which is )
       */
      kid: string

      /**
       * Thumbprint of the key used for client authentication. This value must
       * be the same during token refreshes as the thumbprint of the key used
       * during initial token issuance.
       *
       * @note This value is computed by the AS to ensure that the key used for
       * client auth does not change
       */
      jkt: string
    }

export function compareClientAuth(a: ClientAuth, b: ClientAuth): boolean {
  if (a.method === 'none') {
    if (b.method !== a.method) return false

    return true
  }

  if (a.method === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
    if (b.method !== a.method) return false

    return true
  }

  // Fool-proof
  throw new TypeError('Invalid ClientAuth method')
}

export async function authJwkThumbprint(
  key: Uint8Array | KeyLike,
): Promise<string> {
  try {
    return await calculateJwkThumbprint(await exportJWK(key), 'sha512')
  } catch (err) {
    throw new InvalidClientError('Unable to compute JWK thumbprint', err)
  }
}
