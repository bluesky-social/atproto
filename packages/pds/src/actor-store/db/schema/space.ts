export interface Space {
  uri: string
  policy: string // 'public' | 'member-list' | 'managing-app'
  managingApp: string | null // set iff policy is 'managing-app'
  appAccessType: string // 'open' | 'allowList'
  appAllowed: string // JSON-encoded string[] of allowed client_ids
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
