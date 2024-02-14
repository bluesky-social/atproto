import { Awaitable } from '../util/awaitable.js'
import { ClientId } from './client-id.js'
import { ClientMetadata } from './client-metadata.js'
import { ClientData } from './client-data.js'

// Export all types needed to implement the ClientStore interface
export type { ClientId, ClientMetadata, ClientData, Awaitable }

export interface ClientStore {
  findClient(clientId: ClientId): Awaitable<ClientData>
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
