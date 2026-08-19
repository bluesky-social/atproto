import type { Generated } from 'kysely'
import type { DatetimeString } from '@atproto/lex'

export const firehoseCursorTableName = 'firehose_cursor'

export interface FirehoseCursor {
  service: string
  cursor: number | null
  updatedAt: Generated<DatetimeString>
}

export type PartialDB = {
  [firehoseCursorTableName]: FirehoseCursor
}
