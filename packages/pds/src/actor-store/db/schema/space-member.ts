// Plain host-internal member list, consulted at credential-mint time when a
// space's policy is 'member-list'. Not a synced protocol structure and not
// enumerated to the network (proposal 0016).
export interface SpaceMember {
  space: string
  did: string
}

const tableName = 'space_member'

export type PartialDB = { [tableName]: SpaceMember }
