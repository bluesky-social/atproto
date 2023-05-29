export const tableName = 'suggested_follow'

export interface SuggestedFollow {
  did: string
}

export type PartialDB = {
  [tableName]: SuggestedFollow
}
