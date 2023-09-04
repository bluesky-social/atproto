import { ListViewBasic } from '../../lexicon/types/app/bsky/graph/defs'
import { Label } from '../../lexicon/types/com/atproto/label/defs'
import { BlockAndMuteState } from '../graph'
import { ListInfoMap } from '../graph/types'
import { Labels } from '../label'

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

export type ProfileHydrationState = {
  profiles: ProfileInfoMap
  labels: Labels
  lists: ListInfoMap
  bam: BlockAndMuteState
}

export type ProfileDetailInfo = ProfileInfo & {
  bannerCid: string | null
  followsCount: number | null
  followersCount: number | null
  postsCount: number | null
}

export type ProfileDetailInfoMap = { [did: string]: ProfileDetailInfo }

export type ProfileDetailHydrationState = {
  profilesDetailed: ProfileDetailInfoMap
  labels: Labels
  lists: ListInfoMap
  bam: BlockAndMuteState
}

export const toMapByDid = <T extends { did: string }>(
  items: T[],
): Record<string, T> => {
  return items.reduce((cur, item) => {
    cur[item.did] = item
    return cur
  }, {} as Record<string, T>)
}
