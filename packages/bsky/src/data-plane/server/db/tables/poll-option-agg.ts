import { Generated } from 'kysely'

export const tableName = 'poll_option_agg'

export interface PollOptionAgg {
  pollUri: string
  option: number
  voteCount: Generated<number>
}

export type PartialDB = {
  [tableName]: PollOptionAgg
}
