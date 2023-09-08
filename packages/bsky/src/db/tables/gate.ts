const tableName = 'gate'

export interface Gate {
  uri: string
  cid: string
  creator: string
  postUri: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Gate }
