export interface Like {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

const tableName = 'like'

export type PartialDB = { [tableName]: Like }
