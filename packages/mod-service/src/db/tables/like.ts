import { GeneratedAlways } from 'kysely'

const tableName = 'like'

export interface Like {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
  sortAt: GeneratedAlways<string>
}

export type PartialDB = { [tableName]: Like }
