import { ArrayEl } from '@atproto/common'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../../lexicon/types/app/bsky/actor/defs'
import Database from '../../db'
import { countAll, noMatch } from '../../db/util'
import { Actor } from '../../db/tables/actor'
import { ImageUriBuilder } from '../../image/uri'
import { LabelService } from '../label'

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
      .select([
        'actor.did as did',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.bannerCid as bannerCid',
        'profile.indexedAt as indexedAt',
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('followsCount'),
        this.db.db
          .selectFrom('follow')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('followersCount'),
        this.db.db
          .selectFrom('post')
          .whereRef('creator', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('postsCount'),
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
      ])

    const [profileInfos, labels] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label(this.db).getLabelsForProfiles(dids),
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
              // muted field hydrated on pds
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
      ])

    const [profileInfos, labels] = await Promise.all([
      profileInfosQb.execute(),
      this.services.label(this.db).getLabelsForProfiles(dids),
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
              following: profileInfo?.requesterFollowing || undefined,
              followedBy: profileInfo?.requesterFollowedBy || undefined,
              // muted field hydrated on pds
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
}

type ActorResult = Actor
