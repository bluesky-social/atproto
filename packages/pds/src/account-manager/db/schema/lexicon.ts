import type { LexiconDocument } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/cast'

export interface Lexicon {
  nsid: string
  createdAt: DateISO
  updatedAt: DateISO
  lastSucceededAt: null | DateISO
  uri: null | string
  lexicon: null | JsonEncoded<LexiconDocument>
}

export const tableName = 'lexicon'

export type PartialDB = { [tableName]: Lexicon }
