export interface Space {
  uri: string
  isOwner: number // 0 or 1, sqlite boolean
  isMember: number // 0 or 1, sqlite boolean
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
