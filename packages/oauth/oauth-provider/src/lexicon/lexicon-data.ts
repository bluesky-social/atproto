import { LexiconDoc } from '@atproto/lexicon'

export type LexiconData = {
  createdAt: Date
  updatedAt: Date
  lastSucceededAt: null | Date
  uri: null | string
  lexicon: null | LexiconDoc
}
