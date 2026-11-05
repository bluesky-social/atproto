import type { SpaceRefString } from '@atproto/syntax'

export interface SpaceRepo {
  space: SpaceRefString
  setHash: Uint8Array | null
  rev: string | null
}

const tableName = 'space_repo'

export type PartialDB = { [tableName]: SpaceRepo }
