import type { NsidString, SpaceRefString } from '@atproto/syntax'

export interface Space {
  uri: SpaceRefString
  // Denormalized out of the uri for space_type_idx. The authority isn't: a
  // filter by authority is a range of uris (see authoritySpaceRange).
  type: NsidString
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
