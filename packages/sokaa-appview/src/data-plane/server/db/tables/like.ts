const tableName = 'like'

export interface Like {
  uri: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Like }
