import { Key } from '@atproto/jwk'
import { SimpleStore } from '@atproto-labs/simple-store'

export type InternalStateData = {
  iss: string
  dpopKey: Key
  verifier?: string
  appState?: string
}

export type StateStore = SimpleStore<string, InternalStateData>
