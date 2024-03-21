import { GenericStore } from '@atproto/caching'

import { DidDocument } from './did-document.js'
import { Did } from './did.js'

export type DidCache = GenericStore<Did, DidDocument>
