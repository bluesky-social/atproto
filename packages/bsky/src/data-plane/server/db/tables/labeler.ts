import { GeneratedAlways } from 'kysely'

export const tableName = 'labeler'

export interface Labeler {
  uri: string
  cid: string
  creator: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: Labeler
}
