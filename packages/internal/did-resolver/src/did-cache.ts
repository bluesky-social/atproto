import { Did, DidDocument } from '@atproto/did'
import { SimpleStore } from '@atproto-labs/simple-store'

export type DidCache = SimpleStore<Did, DidDocument>
