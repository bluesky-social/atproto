export const tableName = 'activity_subscription'
export interface ActivitySubscription {
  creator: string
  subjectDid: string
  // key from the bsync stash.
  key: string
  indexedAt: string
  post: boolean
  reply: boolean
}

export type PartialDB = { [tableName]: ActivitySubscription }
