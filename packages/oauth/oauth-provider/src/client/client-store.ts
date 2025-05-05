import { OAuthClientMetadata } from '@atproto/oauth-types'
import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import { ClientId } from './client-id.js'

// Export all types needed to implement the ClientStore interface
export * from './client-data.js'
export * from './client-id.js'
export type { Awaitable, OAuthClientMetadata }

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
