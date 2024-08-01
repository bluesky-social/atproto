const tableName = 'post_gate'

export interface PostGate {
  uri: string
  cid: string
  creator: string
  postUri: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: PostGate }
