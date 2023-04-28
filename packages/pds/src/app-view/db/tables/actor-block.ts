export const tableName = 'actor-block'
export interface ActorBlock {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: ActorBlock }
