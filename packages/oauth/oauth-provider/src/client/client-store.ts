import { OAuthClientMetadata } from '@atproto/oauth-types'
import { Awaitable } from '../lib/util/type.js'
import { ClientId } from './client-id.js'

// Export all types needed to implement the ClientStore interface
export * from './client-data.js'
export * from './client-id.js'
export type { Awaitable }

export interface ClientStore {
  findClient(clientId: ClientId): Awaitable<OAuthClientMetadata>
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
