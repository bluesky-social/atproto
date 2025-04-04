import { GeneratedAlways } from 'kysely'

export const tableName = 'vouch'

export interface Vouch {
  uri: string
  subject: string
  handle: string
  displayName: string
  createdAt: GeneratedAlways<string>
  indexedAt: GeneratedAlways<string>
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: Vouch
}
