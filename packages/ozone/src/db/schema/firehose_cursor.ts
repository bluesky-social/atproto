import { Generated } from 'kysely'

export const firehoseCursorTableName = 'firehose_cursor'

export interface FirehoseCursor {
  service: string
  cursor: number | null
  updatedAt: Generated<string>
}

export type PartialDB = {
  [firehoseCursorTableName]: FirehoseCursor
}
