import {
  OAuthClientId,
  OAuthClientMetadata,
} from '@atproto-labs/oauth-client-metadata'
import { Awaitable } from '../util/awaitable.js'
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

export function asClientStore(
  implementation?: Record<string, unknown> & Partial<ClientStore>,
): ClientStore {
  if (!implementation || !isClientStore(implementation)) {
    throw new Error('Invalid ClientStore implementation')
  }
  return implementation
}
