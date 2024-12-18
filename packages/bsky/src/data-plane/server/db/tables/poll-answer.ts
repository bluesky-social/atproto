import { GeneratedAlways } from 'kysely'

const tableName = 'poll_answer'

export interface PollAnswer {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
  answer: number
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: PollAnswer }
