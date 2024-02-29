export const tableName = 'suggested_follow'

export interface SuggestedFollow {
  did: string
  order: number
}

export type PartialDB = {
  [tableName]: SuggestedFollow
}
