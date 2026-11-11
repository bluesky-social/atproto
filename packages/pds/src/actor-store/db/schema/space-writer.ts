import type { DidString, SpaceRefString } from '@atproto/syntax'

export interface SpaceWriter {
  space: SpaceRefString
  did: DidString
  spaceRev: string
  repoRev: string
  data: Uint8Array
}

const tableName = 'space_writer'

export type PartialDB = { [tableName]: SpaceWriter }
