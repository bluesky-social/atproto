export interface Vote {
  uri: string
  cid: string
  creator: string
  direction: 'up' | 'down'
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

const tableName = 'vote'

export type PartialDB = { [tableName]: Vote }
