import { CID } from 'multiformats/cid'
import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import {
  HydrationMap,
  parseCid,
  parseRecordBytes,
  parseString,
  parseTimestamp,
} from './util'

export type Actor = {
  did: string
  handle?: string
  profile?: ProfileRecord
  profileCid?: CID
  indexedAt?: Date
}

export type Actors = HydrationMap<Actor>

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

  async getActors(dids: string[]): Promise<Actors> {
    const res = await this.dataplane.getActors({ dids })
    return dids.reduce((acc, did, i) => {
      const actor = res.actors[i]
      return acc.set(did, {
        did,
        handle: parseString(actor.handle),
        profile: parseRecordBytes<ProfileRecord>(actor.profile?.record),
        profileCid: parseCid(actor.profile?.cid),
        indexedAt: parseTimestamp(actor.profile?.indexedAt),
      })
    }, new HydrationMap<Actor>())
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
        muted: rels.muted ?? false,
        mutedByList: parseString(rels.mutedByList),
        blockedBy: parseString(rels.blockedBy),
        blocking: parseString(rels.blocking),
        blockedByList: parseString(rels.blockedByList),
        blockingByList: parseString(rels.blockingByList),
        following: parseString(rels.following),
        followedBy: parseString(rels.followedBy),
      })
    }, new HydrationMap<ProfileViewerState>())
  }

  async getProfileAggregates(dids: string[]): Promise<ProfileAggs> {
    const [followers, follows, posts] = await Promise.all([
      this.dataplane.getFollowerCounts({ dids }),
      this.dataplane.getFollowCounts({ dids }),
      this.dataplane.getPostCounts({ dids }),
    ])
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        followers: followers.counts[i] ?? 0,
        follows: follows.counts[i] ?? 0,
        posts: posts.counts[i] ?? 0,
      })
    }, new HydrationMap<ProfileAgg>())
  }
}
