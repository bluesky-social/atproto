import { GeneratedAlways } from 'kysely'

export const tableName = 'vouch'

export interface Vouch {
  uri: string
  cid: string
  creator: string
  subject: string
  handle: string
  displayName: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: Vouch
}
