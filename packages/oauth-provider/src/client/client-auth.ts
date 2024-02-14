import { KeyLike, calculateJwkThumbprint, exportJWK } from 'jose'
import { CLIENT_ASSERTION_TYPE_JWT_BEARER } from './client-credentials.js'

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

export async function authJwkThumbprint(key: Uint8Array | KeyLike) {
  return calculateJwkThumbprint(await exportJWK(key), 'sha512')
}
