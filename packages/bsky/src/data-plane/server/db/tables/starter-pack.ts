import { GeneratedAlways } from 'kysely'

export const tableName = 'starter_pack'

export interface StarterPack {
  uri: string
  cid: string
  creator: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: StarterPack
}
