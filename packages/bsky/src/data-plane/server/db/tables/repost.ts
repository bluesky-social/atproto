import { GeneratedAlways } from 'kysely'

export const tableName = 'repost'

export interface Repost {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  via: string | null
  viaCid: string | null
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: Repost }
