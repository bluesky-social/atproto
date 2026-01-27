import { mapDefined } from '@atproto/common'
import {
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
} from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { app } from '../lexicons'
import { VerificationMeta } from '../proto/bsky_pb'
import {
  ChatDeclarationRecord,
  GermDeclarationRecord,
  NotificationDeclarationRecord,
  ProfileRecord,
  StatusRecord,
} from '../views/types.js'
import {
  HydrationMap,
  RecordInfo,
  isActivitySubscriptionEnabled,
  parseRecord,
  parseString,
  safeTakedownRef,
} from './util'

type AllowActivitySubscriptions = Extract<
  app.bsky.notification.declaration.Main['allowSubscriptions'],
  'followers' | 'mutuals' | 'none'
>

export type Actor = {
  did: DidString
  handle?: HandleString
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
  }
}

export type VerificationHydrationState = {
  issuer: DidString
  uri: AtUriString
  handle: HandleString
  displayName: string
  createdAt: DatetimeString
}

export type VerificationMetaRequired = Required<VerificationMeta>

export type Actors = HydrationMap<Actor, DidString>

export type ChatDeclaration = RecordInfo<ChatDeclarationRecord>
export type ChatDeclarations = HydrationMap<ChatDeclaration, AtUriString>

export type GermDeclaration = RecordInfo<GermDeclarationRecord>
export type GermDeclarations = HydrationMap<GermDeclaration, AtUriString>

export type NotificationDeclaration = RecordInfo<NotificationDeclarationRecord>
export type NotificationDeclarations = HydrationMap<
  NotificationDeclaration,
  AtUriString
>

export type Status = RecordInfo<StatusRecord>
export type Statuses = HydrationMap<Status, AtUriString>

export type ProfileViewerState = {
  muted?: boolean
  mutedByList?: AtUriString
  blockedBy?: AtUriString
  blocking?: AtUriString
  blockedByList?: AtUriString
  blockingByList?: AtUriString
  following?: AtUriString
  followedBy?: AtUriString
}

export type ProfileViewerStates = HydrationMap<ProfileViewerState, DidString>

type ActivitySubscriptionState = {
  post: boolean
  reply: boolean
}

export type ActivitySubscriptionStates = HydrationMap<
  ActivitySubscriptionState | undefined,
  DidString
>

type KnownFollowersState = {
  count: number
  followers: DidString[]
}

export type KnownFollowersStates = HydrationMap<
  KnownFollowersState | undefined,
  DidString
>

export type ProfileAgg = {
  followers: number
  follows: number
  posts: number
  lists: number
  feeds: number
  starterPacks: number
}

export type ProfileAggs = HydrationMap<ProfileAgg, DidString>

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
  ): Promise<(DidString | undefined)[]> {
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
    return handleOrDids.map(
      (id) => (id.startsWith('did:') ? id : didByHandle.get(id)) as DidString,
    )
  }

  async getDidsDefined(handleOrDids: string[]): Promise<DidString[]> {
    const res = await this.getDids(handleOrDids)
    return res.filter((v) => v != null)
  }

  async getActors(
    dids: DidString[],
    opts: {
      includeTakedowns?: boolean
      skipCacheForDids?: DidString[]
    } = {},
  ): Promise<Actors> {
    const { includeTakedowns = false, skipCacheForDids } = opts
    const map: Actors = new HydrationMap()

    if (dids.length) {
      const res = await this.dataplane.getActors({ dids, skipCacheForDids })
      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]

        const actor = res.actors[i]
        const isNoHosted =
          actor.takenDown ||
          (actor.upstreamStatus && actor.upstreamStatus !== 'active')
        if (
          !actor.exists ||
          (isNoHosted && !includeTakedowns) ||
          !!actor.tombstonedAt
        ) {
          map.set(did, null)
          continue
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
          ? parseRecord<GermDeclarationRecord>(
              actor.germRecord,
              includeTakedowns,
            )
          : undefined

        const verifications = mapDefined(
          Object.entries(actor.verifiedBy) as [DidString, VerificationMeta][],
          ([actorDid, verificationMeta]) => {
            if (
              verificationMeta.handle &&
              verificationMeta.rkey &&
              verificationMeta.sortedAt
            ) {
              const uri: AtUriString = `at://${actorDid}/app.bsky.graph.verification/${verificationMeta.rkey}`
              return {
                issuer: actorDid,
                uri,
                handle: verificationMeta.handle as HandleString,
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

        map.set(did, {
          did,
          handle: parseString<HandleString>(actor.handle),
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
      }
    }

    return map
  }

  async getChatDeclarations(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<ChatDeclarations> {
    const map: ChatDeclarations = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getActorChatDeclarationRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<ChatDeclarationRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }

    return map
  }

  async getGermDeclarations(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<GermDeclarations> {
    const map: GermDeclarations = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getGermDeclarationRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<GermDeclarationRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }

    return map
  }

  async getNotificationDeclarations(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<NotificationDeclarations> {
    const map: NotificationDeclarations = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getNotificationDeclarationRecords({
        uris,
      })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<NotificationDeclarationRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }
    return map
  }

  async getStatus(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Statuses> {
    const map: Statuses = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getStatusRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<StatusRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }
    return map
  }

  // "naive" because this method does not verify the existence of the list itself
  // a later check in the main hydrator will remove list uris that have been deleted or
  // repurposed to "curate lists"
  async getProfileViewerStatesNaive(
    dids: DidString[],
    viewer: DidString,
  ): Promise<ProfileViewerStates> {
    const map: ProfileViewerStates = new HydrationMap()

    if (dids.length) {
      const res = await this.dataplane.getRelationships({
        actorDid: viewer,
        targetDids: dids,
      })

      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]
        const rels = res.relationships[i]

        if (viewer === did) {
          // ignore self-follows, self-mutes, self-blocks, self-activity-subscriptions
          map.set(did, {})
          continue
        }

        map.set(did, {
          muted: rels.muted ?? false,
          mutedByList: parseString(rels.mutedByList),
          blockedBy: parseString(rels.blockedBy),
          blocking: parseString<AtUriString>(rels.blocking),
          blockedByList: parseString(rels.blockedByList),
          blockingByList: parseString(rels.blockingByList),
          following: parseString<AtUriString>(rels.following),
          followedBy: parseString(rels.followedBy),
        })
      }
    }
    return map
  }

  async getKnownFollowers(
    dids: DidString[],
    viewer: DidString | null,
  ): Promise<KnownFollowersStates> {
    const map: KnownFollowersStates = new HydrationMap()

    if (viewer) {
      try {
        const { results: knownFollowersResults } =
          await this.dataplane.getFollowsFollowing(
            {
              actorDid: viewer,
              targetDids: dids,
            },
            {
              signal: AbortSignal.timeout(100),
            },
          )

        for (let i = 0; i < dids.length; i++) {
          const did = dids[i]

          const result = knownFollowersResults[i]?.dids

          map.set(
            did,
            result && result.length > 0
              ? {
                  count: result.length,
                  followers: result.slice(0, 5) as DidString[],
                }
              : undefined,
          )
        }
      } catch {
        // ignore errors and return empty map
      }
    }

    return map
  }

  async getActivitySubscriptions(
    dids: DidString[],
    viewer: DidString | null,
  ): Promise<ActivitySubscriptionStates> {
    const map: ActivitySubscriptionStates = new HydrationMap()

    if (viewer) {
      try {
        const { subscriptions } =
          await this.dataplane.getActivitySubscriptionsByActorAndSubjects(
            { actorDid: viewer, subjectDids: dids },
            { signal: AbortSignal.timeout(100) },
          )

        for (let i = 0; i < dids.length; i++) {
          const did = dids[i]
          const state = {
            post: subscriptions[i].post != null,
            reply: subscriptions[i].reply != null,
          }

          if (isActivitySubscriptionEnabled(state)) {
            map.set(did, state)
          } else {
            map.set(did, undefined)
          }
        }
      } catch {
        // ignore errors and return empty map
      }
    }

    return map
  }

  async getProfileAggregates(dids: DidString[]): Promise<ProfileAggs> {
    const map: ProfileAggs = new HydrationMap()

    if (dids.length) {
      const counts = await this.dataplane.getCountsForUsers({ dids })
      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]
        map.set(did, {
          followers: counts.followers[i] ?? 0,
          follows: counts.following[i] ?? 0,
          posts: counts.posts[i] ?? 0,
          lists: counts.lists[i] ?? 0,
          feeds: counts.feeds[i] ?? 0,
          starterPacks: counts.starterPacks[i] ?? 0,
        })
      }
    }
    return map
  }
}
