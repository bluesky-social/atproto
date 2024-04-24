import { SimpleStore } from '@atproto/simple-store'

import { DidDocument } from './did-document.js'
import { Did } from './did.js'

export type DidCache = SimpleStore<Did, DidDocument>
