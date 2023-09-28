import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { jsonStringToLex } from '@atproto/lexicon'
import {
  ProfileViewDetailed,
  ProfileView,
} from '../../lexicon/types/app/bsky/actor/defs'
import { Database } from '../../db'
import { noMatch, notSoftDeletedClause } from '../../db/util'
import { Actor } from '../../db/tables/actor'
import { ImageUriBuilder } from '../../image/uri'
import { LabelService, Labels, getSelfLabels } from '../label'
import { BlockAndMuteState, GraphService } from '../graph'
import { LabelCache } from '../../label-cache'
import {
  ActorInfoMap,
  ProfileDetailHydrationState,
  ProfileHydrationState,
  ProfileInfoMap,
  ProfileViewMap,
  toMapByDid,
} from './types'
import { ListInfoMap } from '../graph/types'

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

  async profiles(
    results: (ActorResult | string)[], // @TODO simplify down to just string[]
    viewer: string | null,
    opts?: { includeSoftDeleted?: boolean },
  ): Promise<ActorInfoMap> {
    if (results.length === 0) return {}
    const dids = results.map((res) => (typeof res === 'string' ? res : res.did))
    const hydrated = await this.profileHydration(dids, {
      viewer,
      ...opts,
    })
    return this.profilePresentation(dids, hydrated, {
      viewer,
      ...opts,
    })
  }

  async profilesBasic(
    results: (ActorResult | string)[],
    viewer: string | null,
    opts?: { omitLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ActorInfoMap> {
    if (results.length === 0) return {}
    const dids = results.map((res) => (typeof res === 'string' ? res : res.did))
    const hydrated = await this.profileHydration(dids, {
      viewer,
      includeSoftDeleted: opts?.includeSoftDeleted,
    })
    return this.profileBasicPresentation(dids, hydrated, {
      viewer,
      omitLabels: opts?.omitLabels,
    })
  }

  async profilesList(
    results: ActorResult[],
    viewer: string | null,
    opts?: { includeSoftDeleted?: boolean },
  ): Promise<ProfileView[]> {
    const profiles = await this.profiles(results, viewer, opts)
    return mapDefined(results, (result) => profiles[result.did])
  }

  async profileDetailHydration(
    dids: string[],
    opts: {
      viewer?: string | null
      includeSoftDeleted?: boolean
    },
    state?: {
      bam: BlockAndMuteState
      labels: Labels
    },
  ): Promise<ProfileDetailHydrationState> {
    const { viewer = null, includeSoftDeleted } = opts
    const { ref } = this.db.db.dynamic
    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids.length ? dids : [''])
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
          .as('viewerFollowing'),
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('viewerFollowedBy'),
      ])
    const [profiles, labels, bam] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label.getLabelsForSubjects(dids, state?.labels),
      this.services.graph.getBlockAndMuteState(
        viewer ? dids.map((did) => [viewer, did]) : [],
        state?.bam,
      ),
    ])
    const listUris = mapDefined(profiles, ({ did }) => {
      const list = viewer && bam.muteList([viewer, did])
      if (!list) return
      return list
    })
    const lists = await this.services.graph.getListViews(listUris, viewer)
    return { profilesDetailed: toMapByDid(profiles), labels, bam, lists }
  }

  profileDetailPresentation(
    dids: string[],
    state: ProfileDetailHydrationState,
    opts: {
      viewer?: string | null
    },
  ): Record<string, ProfileViewDetailed> {
    const { viewer } = opts
    const { profilesDetailed, lists, labels, bam } = state
    return dids.reduce((acc, did) => {
      const prof = profilesDetailed[did]
      if (!prof) return acc
      const avatar = prof?.avatarCid
        ? this.imgUriBuilder.getPresetUri('avatar', prof.did, prof.avatarCid)
        : undefined
      const banner = prof?.bannerCid
        ? this.imgUriBuilder.getPresetUri('banner', prof.did, prof.bannerCid)
        : undefined
      const mutedByListUri = viewer && bam.muteList([viewer, did])
      const mutedByList =
        mutedByListUri && lists[mutedByListUri]
          ? this.services.graph.formatListViewBasic(lists[mutedByListUri])
          : undefined
      const actorLabels = labels[did] ?? []
      const selfLabels = getSelfLabels({
        uri: prof.profileUri,
        cid: prof.profileCid,
        record:
          prof.profileJson !== null
            ? (jsonStringToLex(prof.profileJson) as Record<string, unknown>)
            : null,
      })
      acc[did] = {
        did: prof.did,
        handle: prof.handle ?? INVALID_HANDLE,
        displayName: prof?.displayName || undefined,
        description: prof?.description || undefined,
        avatar,
        banner,
        followsCount: prof?.followsCount ?? 0,
        followersCount: prof?.followersCount ?? 0,
        postsCount: prof?.postsCount ?? 0,
        indexedAt: prof?.indexedAt || undefined,
        viewer: viewer
          ? {
              muted: bam.mute([viewer, did]),
              mutedByList,
              blockedBy: !!bam.blockedBy([viewer, did]),
              blocking: bam.blocking([viewer, did]) ?? undefined,
              following:
                prof?.viewerFollowing && !bam.block([viewer, did])
                  ? prof.viewerFollowing
                  : undefined,
              followedBy:
                prof?.viewerFollowedBy && !bam.block([viewer, did])
                  ? prof.viewerFollowedBy
                  : undefined,
            }
          : undefined,
        labels: [...actorLabels, ...selfLabels],
      }
      return acc
    }, {} as Record<string, ProfileViewDetailed>)
  }

  async profileHydration(
    dids: string[],
    opts: {
      viewer?: string | null
      includeSoftDeleted?: boolean
    },
    state?: {
      bam: BlockAndMuteState
      labels: Labels
    },
  ): Promise<ProfileHydrationState> {
    const { viewer = null, includeSoftDeleted } = opts
    const { ref } = this.db.db.dynamic
    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids.length ? dids : [''])
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
          .as('viewerFollowing'),
        this.db.db
          .selectFrom('follow')
          .if(!viewer, (q) => q.where(noMatch))
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer ?? '')
          .select('uri')
          .as('viewerFollowedBy'),
      ])
    const [profiles, labels, bam] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label.getLabelsForSubjects(dids, state?.labels),
      this.services.graph.getBlockAndMuteState(
        viewer ? dids.map((did) => [viewer, did]) : [],
        state?.bam,
      ),
    ])
    const listUris = mapDefined(profiles, ({ did }) => {
      const list = viewer && bam.muteList([viewer, did])
      if (!list) return
      return list
    })
    const lists = await this.services.graph.getListViews(listUris, viewer)
    return { profiles: toMapByDid(profiles), labels, bam, lists }
  }

  profilePresentation(
    dids: string[],
    state: {
      profiles: ProfileInfoMap
      lists: ListInfoMap
      labels: Labels
      bam: BlockAndMuteState
    },
    opts?: {
      viewer?: string | null
    },
  ): ProfileViewMap {
    const { viewer } = opts ?? {}
    const { profiles, lists, labels, bam } = state
    return dids.reduce((acc, did) => {
      const prof = profiles[did]
      if (!prof) return acc
      const avatar = prof?.avatarCid
        ? this.imgUriBuilder.getPresetUri('avatar', prof.did, prof.avatarCid)
        : undefined
      const mutedByListUri = viewer && bam.muteList([viewer, did])
      const mutedByList =
        mutedByListUri && lists[mutedByListUri]
          ? this.services.graph.formatListViewBasic(lists[mutedByListUri])
          : undefined
      const actorLabels = labels[did] ?? []
      const selfLabels = getSelfLabels({
        uri: prof.profileUri,
        cid: prof.profileCid,
        record:
          prof.profileJson !== null
            ? (jsonStringToLex(prof.profileJson) as Record<string, unknown>)
            : null,
      })
      acc[did] = {
        did: prof.did,
        handle: prof.handle ?? INVALID_HANDLE,
        displayName: prof?.displayName || undefined,
        description: prof?.description || undefined,
        avatar,
        indexedAt: prof?.indexedAt || undefined,
        viewer: viewer
          ? {
              muted: bam.mute([viewer, did]),
              mutedByList,
              blockedBy: !!bam.blockedBy([viewer, did]),
              blocking: bam.blocking([viewer, did]) ?? undefined,
              following:
                prof?.viewerFollowing && !bam.block([viewer, did])
                  ? prof.viewerFollowing
                  : undefined,
              followedBy:
                prof?.viewerFollowedBy && !bam.block([viewer, did])
                  ? prof.viewerFollowedBy
                  : undefined,
            }
          : undefined,
        labels: [...actorLabels, ...selfLabels],
      }
      return acc
    }, {} as ProfileViewMap)
  }

  profileBasicPresentation(
    dids: string[],
    state: ProfileHydrationState,
    opts?: {
      viewer?: string | null
      omitLabels?: boolean
    },
  ): ProfileViewMap {
    const result = this.profilePresentation(dids, state, opts)
    return Object.values(result).reduce((acc, prof) => {
      const profileBasic = {
        did: prof.did,
        handle: prof.handle,
        displayName: prof.displayName,
        avatar: prof.avatar,
        viewer: prof.viewer,
        labels: opts?.omitLabels ? undefined : prof.labels,
      }
      acc[prof.did] = profileBasic
      return acc
    }, {} as ProfileViewMap)
  }
}

type ActorResult = Actor
