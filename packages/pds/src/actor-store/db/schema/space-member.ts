export interface SpaceMember {
  space: string
  did: string
  memberRev: string
  addedAt: string
}

const tableName = 'space_member'

export type PartialDB = { [tableName]: SpaceMember }
