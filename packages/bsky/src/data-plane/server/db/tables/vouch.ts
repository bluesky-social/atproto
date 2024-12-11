import { GeneratedAlways } from 'kysely'

export const tableName = 'vouch'

export interface Follow {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  relationship: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: Follow }
