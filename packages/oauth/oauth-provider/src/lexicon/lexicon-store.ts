import { LexiconDoc } from '@atproto/lexicon'
import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import { LexiconData } from './lexicon-data.js'

export type { Awaitable, LexiconData, LexiconDoc }

export interface LexiconStore {
  findLexicon(nsid: string): Awaitable<LexiconData | null>
  storeLexicon(nsid: string, data: LexiconData): Awaitable<void>
  deleteLexicon(nsid: string): Awaitable<void>
}

export const isLexiconStore = buildInterfaceChecker<LexiconStore>([
  'findLexicon',
  'storeLexicon',
  'deleteLexicon',
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
