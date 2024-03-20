const tableName = 'thread_gate'

export interface ThreadGate {
  uri: string
  cid: string
  creator: string
  postUri: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: ThreadGate }
