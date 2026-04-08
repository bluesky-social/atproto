export interface SpaceMember {
  space: string
  did: string
  addedAt: string
}

const tableName = 'space_member'

export type PartialDB = { [tableName]: SpaceMember }
