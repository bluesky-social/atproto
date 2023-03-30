import { GeneratedAlways } from 'kysely'

const tableName = 'vote'

// @TODO still used in pds by setVote
export interface Vote {
  uri: string
  cid: string
  creator: string
  direction: 'up' | 'down'
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: Vote }
