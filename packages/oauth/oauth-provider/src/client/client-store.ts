import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { Awaitable } from '../lib/util/type.js'
import { buildInterfaceChecker } from '../lib/util/type.js'
import type { ClientId } from './client-id.js'

// Export all types needed to implement the ClientStore interface
export type { Awaitable, ClientId, OAuthClientMetadata }

export interface ClientStore {
  findClient(clientId: ClientId): Awaitable<OAuthClientMetadata>
}

export const isClientStore = buildInterfaceChecker<ClientStore>([
  'findClient', //
])

export function ifClientStore<V extends Partial<ClientStore>>(
  implementation?: V,
): (V & ClientStore) | undefined {
  if (implementation && isClientStore(implementation)) {
    return implementation
  }

  return undefined
}

export function asClientStore<V extends Partial<ClientStore>>(
  implementation?: V,
): V & ClientStore {
  const store = ifClientStore(implementation)
  if (store) return store

  throw new Error('Invalid ClientStore implementation')
}
