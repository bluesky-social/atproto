import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { HydrationMap, parseRecord } from './util'

export type Profile = {
  did: string
  handle: string | null
  record: ProfileRecord | null
}

export type Profiles = HydrationMap<Profile>

export type ProfileViewerState = {
  muted?: boolean
  mutedByList?: string
  blockedBy?: string
  blocking?: string
  blockedByList?: string
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
    const [handles, profiles] = await Promise.all([
      this.dataplane.getHandles({ dids }),
      this.dataplane.getProfiles({ dids }),
    ])
    return dids.reduce((acc, did, i) => {
      const handle = handles[i] ?? null
      const record = parseRecord<Profile>(profiles.records[i])
      return acc.set(did, {
        did,
        handle,
        record,
      })
    }, new HydrationMap<Profile>())
  }

  async getProfileViewerStates(
    dids: string[],
    viewer: string,
  ): Promise<ProfileViewerStates> {
    const res = await this.dataplane.getRelationships({
      actorDid: viewer,
      targetDids: dids,
    })
    return dids.reduce((acc, did, i) => {
      const rels = res.relationships[i]
      return acc.set(did, {
        muted: rels.muted,
        mutedByList: rels.mutedByList.length > 0 ? rels.mutedByList : undefined,
        blockedBy: rels.blockedBy.length > 0 ? rels.blockedBy : undefined,
        blocking: rels.blocking.length > 0 ? rels.blocking : undefined,
        blockedByList:
          rels.blockedByList.length > 0 ? rels.blockedByList : undefined,
        blockingByList:
          rels.blockingByList.length > 0 ? rels.blockingByList : undefined,
        following: rels.following.length > 0 ? rels.following : undefined,
        followedBy: rels.followedBy.length > 0 ? rels.followedBy : undefined,
      })
    }, new HydrationMap<ProfileViewerState>())
  }

  async getProfileAggregates(dids: string[]): Promise<ProfileAggs> {
    const aggs = await Promise.all(dids.map((did) => this.getAggsForDid(did)))
    return dids.reduce((acc, did, i) => {
      return acc.set(did, aggs[i])
    }, new HydrationMap<ProfileAgg>())
  }

  private async getAggsForDid(actorDid: string) {
    const [followers, follows, posts] = await Promise.all([
      this.dataplane.getFollowersCount({ actorDid }),
      this.dataplane.getFollowsCount({ actorDid }),
      { count: 0 }, // @TODO need getPostsCount function
    ])
    return {
      followers: followers.count,
      follows: follows.count,
      posts: posts.count,
    }
  }
}
