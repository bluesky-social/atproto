import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from '@atproto/oauth-types'
import { KeyLike, calculateJwkThumbprint, exportJWK } from 'jose'
import { JOSEError } from 'jose/errors'

import { InvalidClientError } from '../errors/invalid-client-error.js'

export type ClientAuth =
  | { method: 'none' }
  | {
      method: typeof CLIENT_ASSERTION_TYPE_JWT_BEARER
      alg: string
      kid: string
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
    const message =
      err instanceof JOSEError
        ? err.message
        : 'Failed to compute JWK thumbprint'
    throw new InvalidClientError(message, err)
  }
}
