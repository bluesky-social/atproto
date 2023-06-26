import { ArrayEl } from '@atproto/common'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../../lexicon/types/app/bsky/actor/defs'
import Database from '../../db'
import { noMatch } from '../../db/util'
import { Actor } from '../../db/tables/actor'
import { ImageUriBuilder } from '../../image/uri'
import { LabelService } from '../label'
import { ListViewBasic } from '../../lexicon/types/app/bsky/graph/defs'

export class ActorViews {
  constructor(private db: Database, private imgUriBuilder: ImageUriBuilder) {}

  services = {
    label: LabelService.creator(),
  }

  profileDetailed(
    result: ActorResult,
    viewer: string | null,
  ): Promise<ProfileViewDetailed>
  profileDetailed(
    result: ActorResult[],
    viewer: string | null,
  ): Promise<ProfileViewDetailed[]>
  async profileDetailed(
    result: ActorResult | ActorResult[],
    viewer: string | null,
  ): Promise<ProfileViewDetailed | ProfileViewDetailed[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .leftJoin('profile_agg', 'profile_agg.did', 'actor.did')
      .select([
        'actor.did as did',
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
      ])

    const [profileInfos, labels, listMutes] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label(this.db).getLabelsForSubjects(dids),
      this.getListMutes(dids, viewer),
    ])

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            profileInfo.did,
            profileInfo.avatarCid,
          )
        : undefined
      const banner = profileInfo?.bannerCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'banner',
            profileInfo.did,
            profileInfo.bannerCid,
          )
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        banner,
        followsCount: profileInfo?.followsCount ?? 0,
        followersCount: profileInfo?.followersCount ?? 0,
        postsCount: profileInfo?.postsCount ?? 0,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: viewer
          ? {
              following: profileInfo?.requesterFollowing || undefined,
              followedBy: profileInfo?.requesterFollowedBy || undefined,
              muted: !!profileInfo?.requesterMuted || !!listMutes[result.did],
              mutedByList: listMutes[result.did],
              blockedBy: !!profileInfo.requesterBlockedBy,
              blocking: profileInfo.requesterBlocking || undefined,
            }
          : undefined,
        labels: labels[result.did] ?? [],
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  profile(result: ActorResult, viewer: string | null): Promise<ProfileView>
  profile(result: ActorResult[], viewer: string | null): Promise<ProfileView[]>
  async profile(
    result: ActorResult | ActorResult[],
    viewer: string | null,
  ): Promise<ProfileView | ProfileView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic
    const dids = results.map((r) => r.did)

    const profileInfosQb = this.db.db
      .selectFrom('actor')
      .where('actor.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .select([
        'actor.did as did',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.indexedAt as indexedAt',
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
      ])

    const [profileInfos, labels, listMutes] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label(this.db).getLabelsForSubjects(dids),
      this.getListMutes(dids, viewer),
    ])

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            profileInfo.did,
            profileInfo.avatarCid,
          )
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: viewer
          ? {
              muted: !!profileInfo?.requesterMuted || !!listMutes[result.did],
              mutedByList: listMutes[result.did],
              blockedBy: !!profileInfo.requesterBlockedBy,
              blocking: profileInfo.requesterBlocking || undefined,
              following: profileInfo?.requesterFollowing || undefined,
              followedBy: profileInfo?.requesterFollowedBy || undefined,
            }
          : undefined,
        labels: labels[result.did] ?? [],
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  // @NOTE keep in sync with feedService.getActorViews()
  profileBasic(
    result: ActorResult,
    viewer: string | null,
  ): Promise<ProfileViewBasic>
  profileBasic(
    result: ActorResult[],
    viewer: string | null,
  ): Promise<ProfileViewBasic[]>
  async profileBasic(
    result: ActorResult | ActorResult[],
    viewer: string | null,
  ): Promise<ProfileViewBasic | ProfileViewBasic[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const profiles = await this.profile(results, viewer)
    const views = profiles.map((view) => ({
      did: view.did,
      handle: view.handle,
      displayName: view.displayName,
      avatar: view.avatar,
      viewer: view.viewer,
    }))

    return Array.isArray(result) ? views : views[0]
  }

  async getListMutes(
    subjects: string[],
    mutedBy: string | null,
  ): Promise<Record<string, ListViewBasic>> {
    if (mutedBy === null) return {}
    if (subjects.length < 1) return {}
    const res = await this.db.db
      .selectFrom('list_item')
      .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
      .innerJoin('list', 'list.uri', 'list_item.listUri')
      .where('list_mute.mutedByDid', '=', mutedBy)
      .where('list_item.subjectDid', 'in', subjects)
      .selectAll('list')
      .select('list_item.subjectDid as subjectDid')
      .execute()
    return res.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.subjectDid]: {
          uri: cur.uri,
          cid: cur.cid,
          name: cur.name,
          purpose: cur.purpose,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri(
                'avatar',
                cur.creator,
                cur.avatarCid,
              )
            : undefined,
          viewer: {
            muted: true,
          },
          indexedAt: cur.indexedAt,
        },
      }),
      {} as Record<string, ListViewBasic>,
    )
  }
}

type ActorResult = Actor
