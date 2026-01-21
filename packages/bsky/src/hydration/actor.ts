import { AppBskyNotificationDeclaration } from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { DataPlaneClient } from '../data-plane/client'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { Record as StatusRecord } from '../lexicon/types/app/bsky/actor/status'
import { Record as NotificationDeclarationRecord } from '../lexicon/types/app/bsky/notification/declaration'
import { Record as ChatDeclarationRecord } from '../lexicon/types/chat/bsky/actor/declaration'
import { Record as GermDeclarationRecord } from '../lexicon/types/com/germnetwork/declaration'
import { ActivitySubscription, VerificationMeta } from '../proto/bsky_pb'
import {
  HydrationMap,
  RecordInfo,
  isActivitySubscriptionEnabled,
  parseRecord,
  parseString,
  safeTakedownRef,
} from './util'

type AllowActivitySubscriptions = Extract<
  AppBskyNotificationDeclaration.Record['allowSubscriptions'],
  'followers' | 'mutuals' | 'none'
>

export type Actor = {
  did: string
  handle?: string
  profile?: ProfileRecord
  profileCid?: string
  profileTakedownRef?: string
  sortedAt?: Date
  indexedAt?: Date
  takedownRef?: string
  isLabeler: boolean
  allowIncomingChatsFrom?: string
  upstreamStatus?: string
  createdAt?: Date
  priorityNotifications: boolean
  trustedVerifier?: boolean
  verifications: VerificationHydrationState[]
  status?: RecordInfo<StatusRecord>
  germ?: RecordInfo<GermDeclarationRecord>
  allowActivitySubscriptionsFrom: AllowActivitySubscriptions
  /**
   * Debug information for internal development
   */
  debug?: {
    pagerank?: number
    accountTags?: string[]
    profileTags?: string[]
    [key: string]: unknown
  }
}

export type VerificationHydrationState = {
  issuer: string
  uri: string
  handle: string
  displayName: string
  createdAt: string
}

export type VerificationMetaRequired = Required<VerificationMeta>

export type Actors = HydrationMap<Actor>

export type ChatDeclaration = RecordInfo<ChatDeclarationRecord>
export type ChatDeclarations = HydrationMap<ChatDeclaration>

export type GermDeclaration = RecordInfo<GermDeclarationRecord>
export type GermDeclarations = HydrationMap<GermDeclaration>

export type NotificationDeclaration = RecordInfo<NotificationDeclarationRecord>
export type NotificationDeclarations = HydrationMap<NotificationDeclaration>

export type Status = RecordInfo<StatusRecord>
export type Statuses = HydrationMap<Status>

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

type ActivitySubscriptionState = {
  post: boolean
  reply: boolean
}

export type ActivitySubscriptionStates = HydrationMap<
  ActivitySubscriptionState | undefined
>

type KnownFollowersState = {
  count: number
  followers: string[]
}

export type KnownFollowersStates = HydrationMap<KnownFollowersState | undefined>

export type ProfileAgg = {
  followers: number
  follows: number
  posts: number
  lists: number
  feeds: number
  starterPacks: number
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

  async getDids(
    handleOrDids: string[],
    opts?: { lookupUnidirectional?: boolean },
  ): Promise<(string | undefined)[]> {
    const handles = handleOrDids.filter((actor) => !actor.startsWith('did:'))
    const res = handles.length
      ? await this.dataplane.getDidsByHandles({
          handles,
          lookupUnidirectional: opts?.lookupUnidirectional,
        })
      : { dids: [] }
    const didByHandle = handles.reduce(
      (acc, cur, i) => {
        const did = res.dids[i]
        if (did && did.length > 0) {
          return acc.set(cur, did)
        }
        return acc
      },
      new Map() as Map<string, string>,
    )
    return handleOrDids.map((id) =>
      id.startsWith('did:') ? id : didByHandle.get(id),
    )
  }

  async getDidsDefined(handleOrDids: string[]): Promise<string[]> {
    const res = await this.getDids(handleOrDids)
    // @ts-ignore
    return res.filter((did) => did !== undefined)
  }

  async getActors(
    dids: string[],
    opts: {
      includeTakedowns?: boolean
      skipCacheForDids?: string[]
    } = {},
  ): Promise<Actors> {
    const { includeTakedowns = false, skipCacheForDids } = opts
    if (!dids.length) return new HydrationMap<Actor>()
    const res = await this.dataplane.getActors({ dids, skipCacheForDids })
    return dids.reduce((acc, did, i) => {
      const actor = res.actors[i]
      const isNoHosted =
        actor.takenDown ||
        (actor.upstreamStatus && actor.upstreamStatus !== 'active')
      if (
        !actor.exists ||
        (isNoHosted && !includeTakedowns) ||
        !!actor.tombstonedAt
      ) {
        return acc.set(did, null)
      }

      const profile = actor.profile?.record
        ? parseRecord<ProfileRecord>(actor.profile, includeTakedowns)
        : undefined

      const status = actor.statusRecord
        ? parseRecord<StatusRecord>(
            actor.statusRecord,
            /*
             * Always true, we filter this out in the `Views.status()`. If we
             * ever remove that filter, we'll want to reinstate this here.
             */
            true,
          )
        : undefined

      const germ = actor.germRecord
        ? parseRecord<GermDeclarationRecord>(actor.germRecord, includeTakedowns)
        : undefined

      const verifications = mapDefined(
        Object.entries(actor.verifiedBy),
        ([actorDid, verificationMeta]) => {
          if (
            verificationMeta.handle &&
            verificationMeta.rkey &&
            verificationMeta.sortedAt
          ) {
            return {
              issuer: actorDid,
              uri: `at://${actorDid}/app.bsky.graph.verification/${verificationMeta.rkey}`,
              handle: verificationMeta.handle,
              displayName: verificationMeta.displayName,
              createdAt: verificationMeta.sortedAt.toDate().toISOString(),
            }
          }
          // Filter out the verification meta that doesn't contain all info.
          return undefined
        },
      )

      const allowActivitySubscriptionsFrom = (
        val: string,
      ): AllowActivitySubscriptions => {
        switch (val) {
          case 'followers':
          case 'mutuals':
          case 'none':
            return val
          default:
            // The dataplane should set the default of "FOLLOWERS". Just in case.
            return 'followers'
        }
      }

      const debug = {
        pagerank: actor.pagerank,
        accountTags: actor.tags,
        profileTags: actor.profileTags,
      }

      return acc.set(did, {
        did,
        handle: parseString(actor.handle),
        profile: profile?.record,
        profileCid: profile?.cid,
        profileTakedownRef: profile?.takedownRef,
        sortedAt: profile?.sortedAt,
        indexedAt: profile?.indexedAt,
        takedownRef: safeTakedownRef(actor),
        isLabeler: actor.labeler ?? false,
        allowIncomingChatsFrom: actor.allowIncomingChatsFrom || undefined,
        upstreamStatus: actor.upstreamStatus || undefined,
        createdAt: actor.createdAt?.toDate(),
        priorityNotifications: actor.priorityNotifications,
        trustedVerifier: actor.trustedVerifier,
        verifications,
        status: status,
        germ: germ,
        allowActivitySubscriptionsFrom: allowActivitySubscriptionsFrom(
          actor.allowActivitySubscriptionsFrom,
        ),
        debug,
      })
    }, new HydrationMap<Actor>())
  }

  async getChatDeclarations(
    uris: string[],
    includeTakedowns = false,
  ): Promise<ChatDeclarations> {
    if (!uris.length) return new HydrationMap<ChatDeclaration>()
    const res = await this.dataplane.getActorChatDeclarationRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<ChatDeclarationRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<ChatDeclaration>())
  }

  async getGermDeclarations(
    uris: string[],
    includeTakedowns = false,
  ): Promise<GermDeclarations> {
    if (!uris.length) return new HydrationMap<GermDeclaration>()
    const res = await this.dataplane.getGermDeclarationRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<GermDeclarationRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<GermDeclaration>())
  }

  async getNotificationDeclarations(
    uris: string[],
    includeTakedowns = false,
  ): Promise<NotificationDeclarations> {
    if (!uris.length) return new HydrationMap<NotificationDeclaration>()
    const res = await this.dataplane.getNotificationDeclarationRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<NotificationDeclarationRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<NotificationDeclaration>())
  }

  async getStatus(uris: string[], includeTakedowns = false): Promise<Statuses> {
    if (!uris.length) return new HydrationMap<Status>()
    const res = await this.dataplane.getStatusRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<StatusRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Status>())
  }

  // "naive" because this method does not verify the existence of the list itself
  // a later check in the main hydrator will remove list uris that have been deleted or
  // repurposed to "curate lists"
  async getProfileViewerStatesNaive(
    dids: string[],
    viewer: string,
  ): Promise<ProfileViewerStates> {
    if (!dids.length) return new HydrationMap<ProfileViewerState>()
    const res = await this.dataplane.getRelationships({
      actorDid: viewer,
      targetDids: dids,
    })

    return dids.reduce((acc, did, i) => {
      const rels = res.relationships[i]
      if (viewer === did) {
        // ignore self-follows, self-mutes, self-blocks, self-activity-subscriptions
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

  async getKnownFollowers(
    dids: string[],
    viewer: string | null,
  ): Promise<KnownFollowersStates> {
    if (!viewer) return new HydrationMap<KnownFollowersState | undefined>()
    const { results: knownFollowersResults } = await this.dataplane
      .getFollowsFollowing(
        {
          actorDid: viewer,
          targetDids: dids,
        },
        {
          signal: AbortSignal.timeout(100),
        },
      )
      .catch(() => ({ results: [] }))
    return dids.reduce((acc, did, i) => {
      const result = knownFollowersResults[i]?.dids
      return acc.set(
        did,
        result && result.length > 0
          ? {
              count: result.length,
              followers: result.slice(0, 5),
            }
          : undefined,
      )
    }, new HydrationMap<KnownFollowersState | undefined>())
  }

  async getActivitySubscriptions(
    dids: string[],
    viewer: string | null,
  ): Promise<ActivitySubscriptionStates> {
    if (!viewer) {
      return new HydrationMap<ActivitySubscriptionState | undefined>()
    }

    const activitySubscription = (val: ActivitySubscription | undefined) => {
      if (!val) return undefined

      const result = {
        post: !!val.post,
        reply: !!val.reply,
      }
      if (!isActivitySubscriptionEnabled(result)) return undefined

      return result
    }

    const { subscriptions } = await this.dataplane
      .getActivitySubscriptionsByActorAndSubjects(
        { actorDid: viewer, subjectDids: dids },
        { signal: AbortSignal.timeout(100) },
      )
      .catch(() => ({ subscriptions: [] }))

    return dids.reduce((acc, did, i) => {
      return acc.set(did, activitySubscription(subscriptions[i]))
    }, new HydrationMap<ActivitySubscriptionState | undefined>())
  }

  async getProfileAggregates(dids: string[]): Promise<ProfileAggs> {
    if (!dids.length) return new HydrationMap<ProfileAgg>()
    const counts = await this.dataplane.getCountsForUsers({ dids })
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        followers: counts.followers[i] ?? 0,
        follows: counts.following[i] ?? 0,
        posts: counts.posts[i] ?? 0,
        lists: counts.lists[i] ?? 0,
        feeds: counts.feeds[i] ?? 0,
        starterPacks: counts.starterPacks[i] ?? 0,
      })
    }, new HydrationMap<ProfileAgg>())
  }
}
