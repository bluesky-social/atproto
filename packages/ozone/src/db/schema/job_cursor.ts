import type { Generated } from 'kysely'
import type { DatetimeString } from '@atproto/lex'

export const jobCursorTableName = 'job_cursor'

export interface JobCursor {
  job: string
  cursor: string | null
  updatedAt: Generated<DatetimeString>
}

export type PartialDB = {
  [jobCursorTableName]: JobCursor
}
