export interface SpaceMemberOplog {
  space: string
  rev: string
  idx: number
  action: 'add' | 'remove'
  did: string
}

const tableName = 'space_member_oplog'

export type PartialDB = { [tableName]: SpaceMemberOplog }
