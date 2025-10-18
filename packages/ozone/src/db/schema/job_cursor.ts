import { Generated } from 'kysely'

export const jobCursorTableName = 'job_cursor'

export interface JobCursor {
  job: string
  cursor: string | null
  updatedAt: Generated<string>
}

export type PartialDB = {
  [jobCursorTableName]: JobCursor
}
