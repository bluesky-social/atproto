import type { Awaitable } from '../lib/util/type.js'
import { buildInterfaceChecker } from '../lib/util/type.js'
import type { LexiconData } from './lexicon-data.js'

export type * from './lexicon-data.js'
export type { Awaitable }

export interface LexiconStore {
  findLexicon(nsid: string): Awaitable<LexiconData | null>
  storeLexicon(nsid: string, data: LexiconData): Awaitable<void>
  deleteLexicon(nsid: string): Awaitable<void>
}

export const isLexiconStore = buildInterfaceChecker<LexiconStore>([
  'deleteLexicon',
  'findLexicon',
  'storeLexicon',
])

export function ifLexiconStore<V extends Partial<LexiconStore>>(
  implementation?: V,
): (V & LexiconStore) | undefined {
  if (implementation && isLexiconStore(implementation)) {
    return implementation
  }

  return undefined
}

export function asLexiconStore<V extends Partial<LexiconStore>>(
  implementation?: V,
): V & LexiconStore {
  const store = ifLexiconStore(implementation)
  if (store) return store

  throw new Error('Invalid LexiconStore implementation')
}
