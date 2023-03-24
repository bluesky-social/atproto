export const tableName = 'follow'
export interface Follow {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: Follow }
