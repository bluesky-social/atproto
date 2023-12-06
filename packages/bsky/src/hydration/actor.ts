import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'

export type ProfileInfo = {
  did: string
  handle: string | null
  record: ProfileRecord | null
}

export type ProfileInfos = Map<string, ProfileInfo | null>

export type ProfileViewerState = {
  muted?: boolean
  mutedByList?: string
  blockedBy?: boolean
  blocking?: string
  blockingByList?: string
  following?: string
  followedBy?: string
}

export type ProfileViewerStates = Map<string, ProfileViewerState | null>

export type ProfileAgg = {
  followers: number
  follows: number
  posts: number
}

export type ProfileAggs = Map<string, ProfileAgg | null>

export class ActorHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getProfiles(dids: string[]): Promise<ProfileInfos> {
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
