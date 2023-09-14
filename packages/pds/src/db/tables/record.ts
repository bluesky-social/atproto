// @NOTE also used by app-view (moderation)
export interface Record {
  uri: string
  cid: string
  did: string
  collection: string
  rkey: string
  repoRev: string | null
  indexedAt: string
  // opaque identifier, though currently tends to reference a moderation_action
  takedownId: string | null
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
