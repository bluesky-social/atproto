import { Generated } from 'kysely'

export const tableName = 'profile_agg'

export interface ProfileAgg {
  did: string
  followersCount: Generated<number>
  followsCount: Generated<number>
  postsCount: Generated<number>
}

export type PartialDB = {
  [tableName]: ProfileAgg
}
