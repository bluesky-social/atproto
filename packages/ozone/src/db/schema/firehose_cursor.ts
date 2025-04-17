export const firehoseCursorTableName = 'firehose_cursor'

export interface FirehoseCursor {
  service: string
  cursor: string | null
  updatedAt: string
}

export type PartialDB = {
  [firehoseCursorTableName]: FirehoseCursor
}
