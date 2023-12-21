import { CID } from 'multiformats/cid'
import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { HydrationMap, parseCid, parseRecordBytes, parseString } from './util'

export type Actor = {
  did: string
  handle?: string
  profile?: ProfileRecord
  profileCid?: CID
  indexedAt?: Date
  takendown: boolean
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

  async getRepoRevSafe(did: string | null): Promise<string | null> {
    if (!did) return null
    try {
      const res = await this.dataplane.getLatestRev({ actorDid: did })
      return parseString(res.rev) ?? null
    } catch {
      return null
    }
  }

  async getDids(handleOrDids: string[]): Promise<(string | undefined)[]> {
    const handles = handleOrDids.filter((actor) => !actor.startsWith('did:'))
    const res = await this.dataplane.getDidsByHandles({ handles })
    const didByHandle = handles.reduce((acc, cur, i) => {
      const did = res.dids[i]
      if (did && did.length > 0) {
        return acc.set(cur, did)
      }
      return acc
    }, new Map() as Map<string, string>)
    return handleOrDids.map((id) =>
      id.startsWith('did:') ? id : didByHandle.get(id),
    )
  }

  async getDidsDefined(handleOrDids: string[]): Promise<string[]> {
    const res = await this.getDids(handleOrDids)
    // @ts-ignore
    return res.filter((did) => did !== undefined)
  }

  async getActors(dids: string[], includeTakedowns = false): Promise<Actors> {
    const res = await this.dataplane.getActors({ dids })
    return dids.reduce((acc, did, i) => {
      const actor = res.actors[i]
      if (!actor.exists || (actor.takenDown && !includeTakedowns)) {
        return acc.set(did, null)
      }
      const profile =
        includeTakedowns || !actor.profile?.takenDown
          ? actor.profile
          : undefined
      return acc.set(did, {
        did,
        handle: parseString(actor.handle),
        profile: parseRecordBytes<ProfileRecord>(profile?.record),
        profileCid: parseCid(profile?.cid),
        indexedAt: profile?.indexedAt?.toDate(),
        takendown: actor.takenDown ?? false,
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
      if (viewer === did) {
        // ignore self-follows, self-mutes, self-blocks
        return acc.set(did, {})
      }
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
