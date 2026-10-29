// The member list of a space governed by the memberspace policy.
export interface MemberspaceMember {
  space: string
  did: string
  read: 0 | 1
  write: 0 | 1
}

const tableName = 'memberspace_member'

export type PartialDB = { [tableName]: MemberspaceMember }
