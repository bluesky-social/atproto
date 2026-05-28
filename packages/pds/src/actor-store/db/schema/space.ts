export interface Space {
  uri: string
  isOwner: number // 0 or 1, sqlite boolean
  isMember: number // 0 or 1, sqlite boolean
  managingApp: string | null
  isPublic: number // 0 or 1, sqlite boolean
  appAccessMode: string
  appExceptions: string // JSON-encoded string[]
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
