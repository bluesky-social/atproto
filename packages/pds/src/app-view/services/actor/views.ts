import { ArrayEl } from '@atproto/common'
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

  profileDetailed(
    result: ActorResult,
    viewer: string,
  ): Promise<ProfileViewDetailed>
  profileDetailed(
    result: ActorResult[],
    viewer: string,
  ): Promise<ProfileViewDetailed[]>
  async profileDetailed(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileViewDetailed | ProfileViewDetailed[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic

    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('did_handle')
      .where('did_handle.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .leftJoin('profile_agg', 'profile_agg.did', 'did_handle.did')
      .select([
        'did_handle.did as did',
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
      this.services.label.getLabelsForSubjects(dids),
    ])

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const listUris: string[] = profileInfos
      .map((a) => a.requesterMutedByList)
      .filter((list) => !!list)
    const listViews = await this.services.graph.getListViews(listUris, viewer)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri('avatar', profileInfo.avatarCid)
        : undefined
      const banner = profileInfo?.bannerCid
        ? this.imgUriBuilder.getCommonSignedUri('banner', profileInfo.bannerCid)
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: truncateUtf8(profileInfo?.displayName, 64) || undefined,
        description: truncateUtf8(profileInfo?.description, 256) || undefined,
        avatar,
        banner,
        followsCount: profileInfo?.followsCount || 0,
        followersCount: profileInfo?.followersCount || 0,
        postsCount: profileInfo?.postsCount || 0,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          muted:
            !!profileInfo?.requesterMuted ||
            !!profileInfo?.requesterMutedByList,
          mutedByList: profileInfo.requesterMutedByList
            ? this.services.graph.formatListViewBasic(
                listViews[profileInfo.requesterMutedByList],
              )
            : undefined,
          blockedBy: !!profileInfo.requesterBlockedBy,
          blocking: profileInfo.requesterBlocking || undefined,
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
        },
        labels: labels[result.did] ?? [],
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  profile(result: ActorResult, viewer: string): Promise<ProfileView>
  profile(result: ActorResult[], viewer: string): Promise<ProfileView[]>
  async profile(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileView | ProfileView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('did_handle')
      .where('did_handle.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .select([
        'did_handle.did as did',
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
      this.services.label.getLabelsForSubjects(dids),
    ])

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const listUris: string[] = profileInfos
      .map((a) => a.requesterMutedByList)
      .filter((list) => !!list)
    const listViews = await this.services.graph.getListViews(listUris, viewer)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri('avatar', profileInfo.avatarCid)
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: truncateUtf8(profileInfo?.displayName, 64) || undefined,
        description: truncateUtf8(profileInfo?.description, 256) || undefined,
        avatar,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          muted:
            !!profileInfo?.requesterMuted ||
            !!profileInfo?.requesterMutedByList,
          mutedByList: profileInfo.requesterMutedByList
            ? this.services.graph.formatListViewBasic(
                listViews[profileInfo.requesterMutedByList],
              )
            : undefined,
          blockedBy: !!profileInfo.requesterBlockedBy,
          blocking: profileInfo.requesterBlocking || undefined,
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
        },
        labels: labels[result.did] ?? [],
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  // @NOTE keep in sync with feedService.getActorViews()
  profileBasic(result: ActorResult, viewer: string): Promise<ProfileViewBasic>
  profileBasic(
    result: ActorResult[],
    viewer: string,
  ): Promise<ProfileViewBasic[]>
  async profileBasic(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileViewBasic | ProfileViewBasic[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const profiles = await this.profile(results, viewer)
    const views = profiles.map((view) => ({
      did: view.did,
      handle: view.handle,
      displayName: truncateUtf8(view.displayName, 64) || undefined,
      avatar: view.avatar,
      viewer: view.viewer,
      labels: view.labels,
    }))

    return Array.isArray(result) ? views : views[0]
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
