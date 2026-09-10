// Governance for a space this account is the authority for. Only exists for spaces this
// account created: a member holds a repo in a space without being told its policy.
export interface SimplespaceConfig {
  uri: string
  readPolicy: string // 'public' | 'member-list' | 'managing-app'
  readManagingApp: string | null // set iff readPolicy is 'managing-app'
  writePolicy: string // 'public' | 'member-list' | 'managing-app'
  writeManagingApp: string | null // set iff writePolicy is 'managing-app'
  appAccessType: string // 'open' | 'allowList'
  appAllowed: string // JSON-encoded string[] of allowed client_ids
}

const tableName = 'simplespace_config'

export type PartialDB = { [tableName]: SimplespaceConfig }
