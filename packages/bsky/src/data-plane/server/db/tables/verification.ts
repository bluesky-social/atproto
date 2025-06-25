import { GeneratedAlways } from 'kysely'

export const tableName = 'verification'

export interface Verification {
  uri: string
  cid: string
  rkey: string
  creator: string
  subject: string
  handle: string
  displayName: string
  createdAt: string
  indexedAt: string
  sortedAt: GeneratedAlways<string>
}

export type PartialDB = {
  [tableName]: Verification
}
