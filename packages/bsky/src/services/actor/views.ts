import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/identifier'
import { jsonStringToLex } from '@atproto/lexicon'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../../lexicon/types/app/bsky/actor/defs'
import Database from '../../db'
import { noMatch, notSoftDeletedClause } from '../../db/util'
import { Actor } from '../../db/tables/actor'
import { ImageUriBuilder } from '../../image/uri'
import { LabelService, getSelfLabels } from '../label'
import { GraphService } from '../graph'
import { LabelCache } from '../../label-cache'

export class ActorViews {
  constructor(
    private db: Database,
    private imgUriBuilder: ImageUriBuilder,
    private labelCache: LabelCache,
  ) {}

  services = {
    label: LabelService.creator(this.labelCache)(this.db),
    graph: GraphService.creator(this.imgUriBuilder)(this.db),
  }

  async profilesDetailed(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileViewDetailed>> {
    if (results.length === 0) return {}

    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .leftJoin('profile_agg', 'profile_agg.did', 'actor.did')
      .leftJoin('record', 'record.uri', 'profile.uri')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('actor'))),
      )
      .select([
        'actor.did as did',
        'actor.handle as handle',
        'profile.uri as profileUri',
        'profile.cid as profileCid',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.bannerCid as bannerCid',
        'profile.indexedAt as indexedAt',
        'profile_agg.followsCount as followsCount',
        'profile_agg.followersCount as followersCount',
        'profile_agg.postsCount as postsCount',
        'record.json as profileJson',
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('requesterFollowedBy'),
        this.db.db
          .selectFrom('actor_block')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterBlocking'),
        this.db.db
          .selectFrom('actor_block')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('requesterBlockedBy'),
        this.db.db
          .selectFrom('mute')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('subjectDid', '=', ref('actor.did'))
          .where('mutedByDid', '=', viewer ?? '')
          .select('subjectDid')
          .as('requesterMuted'),
        this.db.db
          .selectFrom('list_item')
          .if(!viewer, (q) => q.where(noMatch))
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .where('list_mute.mutedByDid', '=', viewer ?? '')
          .whereRef('list_item.subjectDid', '=', ref('actor.did'))
          .select('list_item.listUri')
          .limit(1)
          .as('requesterMutedByList'),
      ])

    const [profileInfos, labels] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
    ])

    const listUris: string[] = profileInfos
      .map((a) => a.requesterMutedByList)
      .filter((list) => !!list)
    const listViews = await this.services.graph.getListViews(listUris, viewer)

    return profileInfos.reduce((acc, cur) => {
      const avatar = cur?.avatarCid
        ? this.imgUriBuilder.getPresetUri('avatar', cur.did, cur.avatarCid)
        : undefined
      const banner = cur?.bannerCid
        ? this.imgUriBuilder.getPresetUri('banner', cur.did, cur.bannerCid)
        : undefined
      const mutedByList =
        cur.requesterMutedByList && listViews[cur.requesterMutedByList]
          ? this.services.graph.formatListViewBasic(
              listViews[cur.requesterMutedByList],
            )
          : undefined
      const actorLabels = labels[cur.did] ?? []
      const selfLabels = getSelfLabels({
        uri: cur.profileUri,
        cid: cur.profileCid,
        record:
          cur.profileJson !== null
            ? (jsonStringToLex(cur.profileJson) as Record<string, unknown>)
            : null,
      })
      const profile = {
        did: cur.did,
        handle: cur.handle ?? INVALID_HANDLE,
        displayName: cur?.displayName || undefined,
        description: cur?.description || undefined,
        avatar,
        banner,
        followsCount: cur?.followsCount ?? 0,
        followersCount: cur?.followersCount ?? 0,
        postsCount: cur?.postsCount ?? 0,
        indexedAt: cur?.indexedAt || undefined,
        viewer: viewer
          ? {
              following: cur?.requesterFollowing || undefined,
              followedBy: cur?.requesterFollowedBy || undefined,
              muted: !!cur?.requesterMuted || !!cur.requesterMutedByList,
              mutedByList,
              blockedBy: !!cur.requesterBlockedBy,
              blocking: cur.requesterBlocking || undefined,
            }
          : undefined,
        labels: skipLabels ? undefined : [...actorLabels, ...selfLabels],
      }
      acc[cur.did] = profile
      return acc
    }, {} as Record<string, ProfileViewDetailed>)
  }

  async hydrateProfilesDetailed(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewDetailed[]> {
    const profiles = await this.profilesDetailed(results, viewer, opts)
    return mapDefined(results, (result) => profiles[result.did])
  }

  async profileDetailed(
    result: ActorResult,
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewDetailed | null> {
    const profiles = await this.profilesDetailed([result], viewer, opts)
    return profiles[result.did] ?? null
  }

  async profiles(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileView>> {
    if (results.length === 0) return {}

    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .leftJoin('record', 'record.uri', 'profile.uri')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('actor'))),
      )
      .select([
        'actor.did as did',
        'actor.handle as handle',
        'profile.uri as profileUri',
        'profile.cid as profileCid',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.indexedAt as indexedAt',
        'record.json as profileJson',
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('requesterFollowedBy'),
        this.db.db
          .selectFrom('actor_block')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterBlocking'),
        this.db.db
          .selectFrom('actor_block')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('requesterBlockedBy'),
        this.db.db
          .selectFrom('mute')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('subjectDid', '=', ref('actor.did'))
          .where('mutedByDid', '=', viewer ?? '')
          .select('subjectDid')
          .as('requesterMuted'),
        this.db.db
          .selectFrom('list_item')
          .if(!viewer, (q) => q.where(noMatch))
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .where('list_mute.mutedByDid', '=', viewer ?? '')
          .whereRef('list_item.subjectDid', '=', ref('actor.did'))
          .select('list_item.listUri')
          .limit(1)
          .as('requesterMutedByList'),
      ])

    const [profileInfos, labels] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
    ])

    const listUris: string[] = profileInfos
      .map((a) => a.requesterMutedByList)
      .filter((list) => !!list)
    const listViews = await this.services.graph.getListViews(listUris, viewer)

    return profileInfos.reduce((acc, cur) => {
      const avatar = cur?.avatarCid
        ? this.imgUriBuilder.getPresetUri('avatar', cur.did, cur.avatarCid)
        : undefined
      const mutedByList =
        cur.requesterMutedByList && listViews[cur.requesterMutedByList]
          ? this.services.graph.formatListViewBasic(
              listViews[cur.requesterMutedByList],
            )
          : undefined
      const actorLabels = labels[cur.did] ?? []
      const selfLabels = getSelfLabels({
        uri: cur.profileUri,
        cid: cur.profileCid,
        record:
          cur.profileJson !== null
            ? (jsonStringToLex(cur.profileJson) as Record<string, unknown>)
            : null,
      })
      const profile = {
        did: cur.did,
        handle: cur.handle ?? INVALID_HANDLE,
        displayName: cur?.displayName || undefined,
        description: cur?.description || undefined,
        avatar,
        indexedAt: cur?.indexedAt || undefined,
        viewer: viewer
          ? {
              muted: !!cur?.requesterMuted || !!cur.requesterMutedByList,
              mutedByList,
              blockedBy: !!cur.requesterBlockedBy,
              blocking: cur.requesterBlocking || undefined,
              following: cur?.requesterFollowing || undefined,
              followedBy: cur?.requesterFollowedBy || undefined,
            }
          : undefined,
        labels: skipLabels ? undefined : [...actorLabels, ...selfLabels],
      }
      acc[cur.did] = profile
      return acc
    }, {} as Record<string, ProfileView>)
  }

  async hydrateProfiles(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileView[]> {
    const profiles = await this.profiles(results, viewer, opts)
    return mapDefined(results, (result) => profiles[result.did])
  }

  async profile(
    result: ActorResult,
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileView | null> {
    const profiles = await this.profiles([result], viewer, opts)
    return profiles[result.did] ?? null
  }

  // @NOTE keep in sync with feedService.getActorViews()
  async profilesBasic(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileViewBasic>> {
    if (results.length === 0) return {}
    const profiles = await this.profiles(results, viewer, opts)
    return Object.values(profiles).reduce((acc, cur) => {
      const profile = {
        did: cur.did,
        handle: cur.handle,
        displayName: cur.displayName,
        avatar: cur.avatar,
        viewer: cur.viewer,
      }
      acc[cur.did] = profile
      return acc
    }, {} as Record<string, ProfileViewBasic>)
  }

  async hydrateProfilesBasic(
    results: ActorResult[],
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewBasic[]> {
    const profiles = await this.profilesBasic(results, viewer, opts)
    return mapDefined(results, (result) => profiles[result.did])
  }

  async profileBasic(
    result: ActorResult,
    viewer: string | null,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewBasic | null> {
    const profiles = await this.profilesBasic([result], viewer, opts)
    return profiles[result.did] ?? null
  }
}

type ActorResult = Actor
