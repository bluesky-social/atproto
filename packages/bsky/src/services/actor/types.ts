import { ListViewBasic } from '../../lexicon/types/app/bsky/graph/defs'
import { Label } from '../../lexicon/types/com/atproto/label/defs'

export const kSelfLabels = Symbol('selfLabels')

export type ActorInfo = {
  did: string
  handle: string
  displayName?: string
  description?: string // omitted from basic profile view
  avatar?: string
  indexedAt?: string // omitted from basic profile view
  viewer?: {
    muted?: boolean
    mutedByList?: ListViewBasic
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

export type ProfileViewMap = ActorInfoMap

export type ProfileInfo = {
  did: string
  handle: string | null
  profileUri: string | null
  profileCid: string | null
  displayName: string | null
  description: string | null
  avatarCid: string | null
  indexedAt: string | null
  profileJson: string | null
  viewerFollowing: string | null
  viewerFollowedBy: string | null
}

export type ProfileInfoMap = { [did: string]: ProfileInfo }

export const toMapByDid = <T extends { did: string }>(
  items: T[],
): Record<string, T> => {
  return items.reduce((cur, item) => {
    cur[item.did] = item
    return cur
  }, {} as Record<string, T>)
}
