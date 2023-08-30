import { Label } from '../../lexicon/types/com/atproto/label/defs'

export const kSelfLabels = Symbol('selfLabels')

export type ActorInfo = {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  viewer?: {
    muted?: boolean
    blockedBy?: boolean
    blocking?: string
    following?: string
    followedBy?: string
  }
  labels?: Label[]
  // allows threading self-labels through if they are going to be applied later, i.e. when using skipLabels option.
  [kSelfLabels]?: Label[]
}
export type ActorInfoMap = { [did: string]: ActorInfo }
