export interface SpaceMember {
  space: string
  did: string
  memberRev: string
}

const tableName = 'space_member'

export type PartialDB = { [tableName]: SpaceMember }
