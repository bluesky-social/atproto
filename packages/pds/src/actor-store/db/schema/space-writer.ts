import type { DidString, SpaceRefString } from '@atproto/syntax'

export interface SpaceWriter {
  space: SpaceRefString
  did: DidString
  spaceRev: string
  repoRev: string
  data: Uint8Array
  // Set while the repo is removed from the writer set. The row is kept so that
  // listWriters can report the removal.
  removedAt: string | null
}

const tableName = 'space_writer'

export type PartialDB = { [tableName]: SpaceWriter }
