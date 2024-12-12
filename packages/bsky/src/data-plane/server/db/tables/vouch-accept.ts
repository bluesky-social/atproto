import { GeneratedAlways } from 'kysely'

export const tableName = 'vouch_accept'

export interface VouchAccept {
  uri: string
  cid: string
  creator: string
  vouchUri: string
  vouchCid: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: VouchAccept }
