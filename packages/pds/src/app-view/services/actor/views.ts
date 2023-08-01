import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../../../lexicon/types/app/bsky/actor/defs'
import { DidHandle } from '../../../db/tables/did-handle'
import Database from '../../../db'
import { ImageUriBuilder } from '../../../image/uri'
import { LabelService } from '../label'
import { GraphService } from '../graph'
import { LabelCache } from '../../../label-cache'
import { notSoftDeletedClause } from '../../../db/util'

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
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileViewDetailed>> {
    if (results.length === 0) return {}

    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}

    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('did_handle')
      .where('did_handle.did', 'in', dids)
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .leftJoin('profile_agg', 'profile_agg.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .select([
        'did_handle.did as did',
        'did_handle.handle as handle',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.bannerCid as bannerCid',
        'profile.indexedAt as indexedAt',
        'profile_agg.followsCount as followsCount',
        'profile_agg.followersCount as followersCount',
        'profile_agg.postsCount as postsCount',
        this.db.db
          .selectFrom('follow')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('did_handle.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('did_handle.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterFollowedBy'),
        this.db.db
          .selectFrom('actor_block')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('did_handle.did'))
          .select('uri')
          .as('requesterBlocking'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', ref('did_handle.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterBlockedBy'),
        this.db.db
          .selectFrom('mute')
          .whereRef('did', '=', ref('did_handle.did'))
          .where('mutedByDid', '=', viewer)
          .select('did')
          .as('requesterMuted'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .where('list_mute.mutedByDid', '=', viewer)
          .whereRef('list_item.subjectDid', '=', ref('did_handle.did'))
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
        ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
        : undefined
      const banner = cur?.bannerCid
        ? this.imgUriBuilder.getCommonSignedUri('banner', cur.bannerCid)
        : undefined
      const profile = {
        did: cur.did,
        handle: cur.handle,
        displayName: truncateUtf8(cur?.displayName, 64) || undefined,
        description: truncateUtf8(cur?.description, 256) || undefined,
        avatar,
        banner,
        followsCount: cur?.followsCount || 0,
        followersCount: cur?.followersCount || 0,
        postsCount: cur?.postsCount || 0,
        indexedAt: cur?.indexedAt || undefined,
        viewer: {
          muted: !!cur?.requesterMuted || !!cur?.requesterMutedByList,
          mutedByList: cur.requesterMutedByList
            ? this.services.graph.formatListViewBasic(
                listViews[cur.requesterMutedByList],
              )
            : undefined,
          blockedBy: !!cur.requesterBlockedBy,
          blocking: cur.requesterBlocking || undefined,
          following: cur?.requesterFollowing || undefined,
          followedBy: cur?.requesterFollowedBy || undefined,
        },
        labels: labels[cur.did] ?? [],
      }
      return {
        ...acc,
        [cur.did]: profile,
      }
    }, {} as Record<string, ProfileViewDetailed>)
  }

  async profileDetailed(
    result: ActorResult,
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewDetailed | null> {
    const profiles = await this.profilesDetailed([result], viewer, opts)
    return profiles[result.did] ?? null
  }

  async profiles(
    results: ActorResult[],
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileView>> {
    if (results.length === 0) return {}

    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('did_handle')
      .where('did_handle.did', 'in', dids)
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .select([
        'did_handle.did as did',
        'did_handle.handle as handle',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.indexedAt as indexedAt',
        this.db.db
          .selectFrom('follow')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('did_handle.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('did_handle.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterFollowedBy'),
        this.db.db
          .selectFrom('actor_block')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('did_handle.did'))
          .select('uri')
          .as('requesterBlocking'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', ref('did_handle.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterBlockedBy'),
        this.db.db
          .selectFrom('mute')
          .whereRef('did', '=', ref('did_handle.did'))
          .where('mutedByDid', '=', viewer)
          .select('did')
          .as('requesterMuted'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .where('list_mute.mutedByDid', '=', viewer)
          .whereRef('list_item.subjectDid', '=', ref('did_handle.did'))
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
        ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
        : undefined
      const profile = {
        did: cur.did,
        handle: cur.handle,
        displayName: truncateUtf8(cur?.displayName, 64) || undefined,
        description: truncateUtf8(cur?.description, 256) || undefined,
        avatar,
        indexedAt: cur?.indexedAt || undefined,
        viewer: {
          muted: !!cur?.requesterMuted || !!cur?.requesterMutedByList,
          mutedByList: cur.requesterMutedByList
            ? this.services.graph.formatListViewBasic(
                listViews[cur.requesterMutedByList],
              )
            : undefined,
          blockedBy: !!cur.requesterBlockedBy,
          blocking: cur.requesterBlocking || undefined,
          following: cur?.requesterFollowing || undefined,
          followedBy: cur?.requesterFollowedBy || undefined,
        },
        labels: labels[cur.did] ?? [],
      }
      return {
        ...acc,
        [cur.did]: profile,
      }
    }, {} as Record<string, ProfileView>)
  }

  async profile(
    result: ActorResult,
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileView | null> {
    const profiles = await this.profiles([result], viewer, opts)
    return profiles[result.did] ?? null
  }

  // @NOTE keep in sync with feedService.getActorViews()
  async profilesBasic(
    results: ActorResult[],
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<Record<string, ProfileViewBasic>> {
    if (results.length === 0) return {}

    const profiles = await this.profiles(results, viewer, opts)

    return Object.values(profiles).reduce((acc, cur) => {
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          handle: cur.handle,
          displayName: truncateUtf8(cur.displayName, 64) || undefined,
          avatar: cur.avatar,
          viewer: cur.viewer,
          labels: cur.labels,
        },
      }
    }, {} as Record<string, ProfileViewBasic>)
  }

  async profileBasic(
    result: ActorResult,
    viewer: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean },
  ): Promise<ProfileViewBasic | null> {
    const profiles = await this.profilesBasic([result], viewer, opts)
    return profiles[result.did] ?? null
  }
}

type ActorResult = DidHandle

function truncateUtf8(str: string | null | undefined, length: number) {
  if (!str) return str
  const encoder = new TextEncoder()
  const utf8 = encoder.encode(str)
  if (utf8.length > length) {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const truncated = utf8.slice(0, length)
    return decoder.decode(truncated).replace(/\uFFFD$/, '')
  }
  return str
}
