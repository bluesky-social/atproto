export interface SpaceMemberState {
  space: string
  setHash: Uint8Array | null
  rev: string | null
}

const tableName = 'space_member_state'

export type PartialDB = { [tableName]: SpaceMemberState }
