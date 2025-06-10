import { Key } from '@atproto/jwk'
import { SimpleStore } from '@atproto-labs/simple-store'
import { ClientAuthMethod } from './oauth-client-auth.js'

export type InternalStateData = {
  iss: string
  dpopKey: Key
  /** @note optional for legacy reasons */
  authMethod?: ClientAuthMethod
  verifier?: string
  appState?: string
}

export type StateStore = SimpleStore<string, InternalStateData>
