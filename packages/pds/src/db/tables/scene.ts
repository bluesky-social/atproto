export interface Scene {
  handle: string
  owner: string
  createdAt: string
}

export const tableName = 'scene'

export type PartialDB = { [tableName]: Scene }
