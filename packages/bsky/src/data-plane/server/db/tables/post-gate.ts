const tableName = 'post_gate'

export interface Postgate {
  uri: string
  cid: string
  creator: string
  postUri: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Postgate }
