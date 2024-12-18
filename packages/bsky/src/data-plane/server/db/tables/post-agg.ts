import { Generated } from 'kysely'

export const tableName = 'post_agg'

export interface PostAgg {
  uri: string
  likeCount: Generated<number>
  replyCount: Generated<number>
  repostCount: Generated<number>
  quoteCount: Generated<number>
  pollAnswerCount: Generated<number>
  pollAnswers: Generated<number[]>
}

export type PartialDB = {
  [tableName]: PostAgg
}
