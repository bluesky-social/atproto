export const tableName = 'suggested_feed'

export interface SuggestedFeed {
  uri: string
  order: number
}

export type PartialDB = {
  [tableName]: SuggestedFeed
}
