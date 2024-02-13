import { GeneratedAlways } from 'kysely'

export const tableName = 'mod_service'

export interface ModService {
  uri: string
  cid: string
  creator: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: ModService
}
