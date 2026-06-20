import { GeneratedAlways } from 'kysely'

const tableName = 'poll'

export interface Poll {
  uri: string
  cid: string
  creator: string
  endsAt: string | null
  // set once the poll-closer job has notified the author + voters
  endedNotifiedAt: string | null
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: Poll }
