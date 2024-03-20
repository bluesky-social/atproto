export const tableName = 'profile'

export interface Profile {
  uri: string
  cid: string
  creator: string
  displayName: string | null
  description: string | null
  avatarCid: string | null
  bannerCid: string | null
  indexedAt: string
}
export type PartialDB = { [tableName]: Profile }
