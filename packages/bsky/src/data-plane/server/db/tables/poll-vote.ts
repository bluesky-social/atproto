import { GeneratedAlways } from 'kysely'

const tableName = 'poll_vote'

export interface PollVote {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  option: number
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: PollVote }
