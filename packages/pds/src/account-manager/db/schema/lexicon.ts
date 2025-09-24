import type { LexiconDoc } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/cast'

export interface Lexicon {
  nsid: string
  createdAt: DateISO
  updatedAt: DateISO
  lastSucceededAt: null | DateISO
  uri: null | string
  lexicon: null | JsonEncoded<LexiconDoc>
}

export const tableName = 'lexicon'

export type PartialDB = { [tableName]: Lexicon }
