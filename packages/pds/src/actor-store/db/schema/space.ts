export interface Space {
  uri: string
  isOwner: number // 0 or 1, sqlite boolean
  // simplespace config (only meaningful when isOwner). See proposal 0016.
  mintPolicy: string // 'public' | 'member-list' | 'managing-app'
  managingApp: string | null
  appAccessType: string // 'open' | 'allowList' (the appAccess union tag)
  appAllowed: string // JSON-encoded string[] of allowed client_ids
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
