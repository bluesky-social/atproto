import { HydrationMap } from './util'

export type Actor = {
  did: string
  handle?: string
  displayName?: string
  description?: string
  avatarCid?: string
  bannerCid?: string
  followersCount: number
  postsCount: number
  upstreamStatus?: string
  indexedAt?: string
}

export type Actors = HydrationMap<Actor>

export type ProfileViewerState = {
  following?: string
  followedBy?: string
}

export type ProfileViewerStates = HydrationMap<ProfileViewerState>
