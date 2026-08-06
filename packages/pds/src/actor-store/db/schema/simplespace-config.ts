// Governance for a space this account is the authority for. Only exists for spaces this
// account created: a member holds a repo in a space without being told its policy.
export interface SimplespaceConfig {
  uri: string
  policy: string // 'public' | 'member-list' | 'managing-app'
  managingApp: string | null // set iff policy is 'managing-app'
  appAccessType: string // 'open' | 'allowList'
  appAllowed: string // JSON-encoded string[] of allowed client_ids
}

const tableName = 'simplespace_config'

export type PartialDB = { [tableName]: SimplespaceConfig }
