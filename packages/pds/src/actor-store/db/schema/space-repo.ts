export interface SpaceRepo {
  space: string
  setHash: Uint8Array | null
  rev: string | null
}

const tableName = 'space_repo'

export type PartialDB = { [tableName]: SpaceRepo }
