import type { PermissionSetLexiconDoc } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/cast'

export interface Lexicon {
  nsid: string
  createdAt: DateISO
  updatedAt: DateISO
  lastSucceededAt: DateISO
  uri: string
  lexicon: JsonEncoded<PermissionSetLexiconDoc>
}

export const tableName = 'lexicon'

export type PartialDB = { [tableName]: Lexicon }
