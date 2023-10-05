// @NOTE also used by app-view (moderation)
export interface Record {
  uri: string
  cid: string
  collection: string
  rkey: string
  repoRev: string | null
  indexedAt: string
  takedownId: string | null
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
