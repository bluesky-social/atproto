export interface Draft {
  creator: string
  key: string
  savedAt: string
  payload: string
}

export const tableName = 'draft'

export type PartialDB = { [tableName]: Draft }
