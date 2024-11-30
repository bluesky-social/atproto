import { SimpleStore } from '@atproto-labs/simple-store'
import { Key } from '@atproto/jwk'

export type InternalStateData = {
  iss: string
  dpopKey: Key
  verifier?: string
  appState?: string
}

export type StateStore = SimpleStore<string, InternalStateData>
