export const firehoseCursorTableName = 'firehose_cursor'

export interface FirehoseCursor {
  service: string
  cursor: number | null
  updatedAt: string
}

export type PartialDB = {
  [firehoseCursorTableName]: FirehoseCursor
}
