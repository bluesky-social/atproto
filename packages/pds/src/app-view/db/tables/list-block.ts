export const tableName = 'list_block'

export interface ListBlock {
  uri: string
  cid: string
  creator: string
  subjectUri: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: ListBlock }
