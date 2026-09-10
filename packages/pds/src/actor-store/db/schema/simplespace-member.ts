// Host-internal access list for simplespace's member-list policies.
export interface SimplespaceMember {
  space: string
  did: string
  read: 0 | 1
  write: 0 | 1
}

const tableName = 'simplespace_member'

export type PartialDB = { [tableName]: SimplespaceMember }
