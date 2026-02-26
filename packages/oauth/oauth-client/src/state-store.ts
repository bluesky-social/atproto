import { Key } from '@atproto/jwk'
import { SimpleStore } from '@atproto-labs/simple-store'
import { ClientAuthMethod } from './oauth-client-auth.js'

export type InternalStateData = {
  iss: string
  dpopKey: Key
  authMethod: ClientAuthMethod
  verifier: string
  appState?: string
}

/**
 * A store pending oauth authorization flows. The key is the "state" parameter
 * used in the authorization request, and the value is an object containing the
 * necessary information to complete the flow once the user is redirected back
 * to the client.
 *
 * @note The data stored in this store is typically short-lived. It should be
 * automatically cleared after a certain period of time (e.g. 1 hour) to prevent
 * the store from growing indefinitely. It is up to the implementation to
 * implement this cleanup mechanism.
 */
export type StateStore = SimpleStore<string, InternalStateData>
