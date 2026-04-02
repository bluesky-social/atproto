export interface SpaceRoot {
  space: string
  setHash: Uint8Array
  rev: string
  indexedAt: string
}

const tableName = 'space_root'

export type PartialDB = { [tableName]: SpaceRoot }
