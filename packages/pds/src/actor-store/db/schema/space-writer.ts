export interface SpaceWriter {
  space: string
  did: string
  spaceRev: string
  repoRev: string
  hash: Uint8Array
}

const tableName = 'space_writer'

export type PartialDB = { [tableName]: SpaceWriter }
