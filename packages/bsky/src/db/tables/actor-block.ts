import { GeneratedAlways } from 'kysely'

export const tableName = 'actor_block'
export interface ActorBlock {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: ActorBlock }
