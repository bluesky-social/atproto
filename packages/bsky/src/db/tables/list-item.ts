import { GeneratedAlways } from 'kysely'

export const tableName = 'list_item'

export interface ListItem {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  listUri: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: ListItem }
