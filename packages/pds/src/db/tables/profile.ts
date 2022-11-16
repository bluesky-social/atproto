export const tableName = 'profile'

export interface Profile {
  uri: string
  cid: string
  creator: string
  displayName: string
  description: string | null
  indexedAt: string
}
export type PartialDB = { [tableName]: Profile }
