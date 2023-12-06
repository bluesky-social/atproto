import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { HydrationMap } from './util'

export type Profile = {
  did: string
  handle: string | null
  record: ProfileRecord | null
}

export type Profiles = HydrationMap<Profile>

export type ProfileViewerState = {
  muted?: boolean
  mutedByList?: string
  blockedBy?: boolean
  blocking?: string
  blockingByList?: string
  following?: string
  followedBy?: string
}

export type ProfileViewerStates = HydrationMap<ProfileViewerState>

export type ProfileAgg = {
  followers: number
  follows: number
  posts: number
}

export type ProfileAggs = HydrationMap<ProfileAgg>

export class ActorHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getProfiles(dids: string[]): Promise<Profiles> {
    throw new Error('unimplemented')
  }

  async getProfileViewerStates(
    dids: string[],
    viewer: string,
  ): Promise<ProfileViewerStates> {
    throw new Error('unimplemented')
  }

  async getProfileAggregates(dids: string[]): Promise<ProfileAggs> {
    throw new Error('unimplemented')
  }
}
