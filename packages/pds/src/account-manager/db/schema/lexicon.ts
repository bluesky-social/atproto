import type { LexiconDocument } from '@atproto/oauth-provider/store'
import type { DateISO, JsonEncoded } from '../../../db/cast.js'

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
