import type { DidString, NsidString, SpaceRefString } from '@atproto/syntax'

export interface Space {
  uri: SpaceRefString
  // Both denormalized out of the uri, so spaces can be filtered without matching on it.
  authority: DidString
  type: NsidString
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
