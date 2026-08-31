import type { GeneratedAlways } from 'kysely'

export const tableName = 'reference_list_opt_out'

export interface ReferenceListOptOut {
  uri: string
  cid: string
  creator: string
  subjectUri: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: ReferenceListOptOut }
