// Plain host-internal member list, consulted at credential-mint time when a
// space's policy is 'member-list'. Not a synced protocol structure and not
// enumerated to the network.
export interface SimplespaceMember {
  space: string
  did: string
}

const tableName = 'simplespace_member'

export type PartialDB = { [tableName]: SimplespaceMember }
