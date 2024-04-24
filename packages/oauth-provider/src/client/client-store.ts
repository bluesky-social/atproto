import { OAuthClientId, OAuthClientMetadata } from '@atproto/oauth-types'

import { Awaitable } from '../lib/util/type.js'
import { ClientData } from './client-data.js'

// Export all types needed to implement the ClientStore interface
export type { Awaitable, ClientData, OAuthClientId, OAuthClientMetadata }

export interface ClientStore {
  findClient(clientId: OAuthClientId): Awaitable<ClientData>
}

export function isClientStore(
  implementation: Record<string, unknown> & Partial<ClientStore>,
): implementation is Record<string, unknown> & ClientStore {
  return typeof implementation.findClient === 'function'
}

export function ifClientStore(
  implementation?: Record<string, unknown> & Partial<ClientStore>,
): ClientStore | undefined {
  if (implementation && isClientStore(implementation)) {
    return implementation
  }

  return undefined
}

export function asClientStore(
  implementation?: Record<string, unknown> & Partial<ClientStore>,
): ClientStore {
  const store = ifClientStore(implementation)
  if (store) return store

  throw new Error('Invalid ClientStore implementation')
}
