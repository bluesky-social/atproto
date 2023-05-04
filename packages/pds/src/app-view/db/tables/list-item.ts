export const tableName = 'list_item'

export interface ListItem {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  listUri: string
  reason: string | null
  reasonFacets: string | null
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: ListItem }
