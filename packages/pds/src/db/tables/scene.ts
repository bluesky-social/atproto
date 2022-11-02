export interface Scene {
  handle: string
  creator: string
  createdAt: string
}

export const tableName = 'scene'

export type PartialDB = { [tableName]: Scene }
