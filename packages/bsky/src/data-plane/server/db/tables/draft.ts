export interface Draft {
  creator: string
  key: string
  createdAt: string
  updatedAt: string
  payload: string
}

export const tableName = 'draft'

export type PartialDB = { [tableName]: Draft }
