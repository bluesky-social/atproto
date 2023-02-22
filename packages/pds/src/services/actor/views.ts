import { ArrayEl } from '@atproto/common'
import { WithInfo as ActorWithInfo } from '../../lexicon/types/app/bsky/actor/ref'
import {
  View as ProfileView,
  ViewBasic as ProfileViewBasic,
} from '../../lexicon/types/app/bsky/actor/profile'
import { DidHandle } from '../../db/tables/did-handle'
import { countAll } from '../../db/util'
import Database from '../../db'
import { getDeclarationSimple } from '../../api/app/bsky/util'
import { ImageUriBuilder } from '../../image/uri'

export class ActorViews {
  constructor(private db: Database, private imgUriBuilder: ImageUriBuilder) {}

  profile(result: UserResult, viewer: string): Promise<ProfileView>
  profile(result: UserResult[], viewer: string): Promise<ProfileView[]>
  async profile(
    result: UserResult | UserResult[],
    viewer: string,
  ): Promise<ProfileView | ProfileView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic

    const profileInfos = await this.db.db
      .selectFrom('did_handle')
      .where(
        'did_handle.did',
        'in',
        results.map((r) => r.did),
      )
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .select([
        'did_handle.did as did',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.bannerCid as bannerCid',
        'profile.indexedAt as indexedAt',
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('did_handle.did'))
          .select(countAll.as('count'))
          .as('followsCount'),
        this.db.db
          .selectFrom('follow')
          .whereRef('subjectDid', '=', ref('did_handle.did'))
          .select(countAll.as('count'))
          .as('followersCount'),
        this.db.db
          .selectFrom('post')
          .whereRef('creator', '=', ref('did_handle.did'))
          .select(countAll.as('count'))
          .as('postsCount'),
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
          .selectFrom('mute')
          .whereRef('did', '=', ref('did_handle.did'))
          .where('mutedByDid', '=', viewer)
          .select('did')
          .as('requesterMuted'),
      ])
      .execute()

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

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
        declaration: getDeclarationSimple(result),
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        banner,
        followsCount: profileInfo?.followsCount ?? 0,
        followersCount: profileInfo?.followersCount ?? 0,
        postsCount: profileInfo?.postsCount ?? 0,
        creator: result.did,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          muted: !!profileInfo?.requesterMuted,
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
        },
        myState: {
          follow: profileInfo?.requesterFollowing || undefined,
          muted: !!profileInfo?.requesterMuted,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  profileBasic(result: UserResult, viewer: string): Promise<ProfileViewBasic>
  profileBasic(
    result: UserResult[],
    viewer: string,
  ): Promise<ProfileViewBasic[]>
  async profileBasic(
    result: UserResult | UserResult[],
    viewer: string,
  ): Promise<ProfileViewBasic | ProfileViewBasic[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic

    const profileInfos = await this.db.db
      .selectFrom('did_handle')
      .where(
        'did_handle.did',
        'in',
        results.map((r) => r.did),
      )
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
          .selectFrom('mute')
          .whereRef('did', '=', ref('did_handle.did'))
          .where('mutedByDid', '=', viewer)
          .select('did')
          .as('requesterMuted'),
      ])
      .execute()

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri('avatar', profileInfo.avatarCid)
        : undefined
      return {
        did: result.did,
        declaration: getDeclarationSimple(result),
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          muted: !!profileInfo?.requesterMuted,
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  // @NOTE keep in sync with feedService.getActorViews()
  actorWithInfo(result: UserResult, viewer: string): Promise<ActorWithInfo>
  actorWithInfo(result: UserResult[], viewer: string): Promise<ActorWithInfo[]>
  async actorWithInfo(
    result: UserResult | UserResult[],
    viewer: string,
  ): Promise<ActorWithInfo | ActorWithInfo[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const profiles = await this.profileBasic(results, viewer)
    const views = profiles.map((view) => ({
      did: view.did,
      declaration: view.declaration,
      handle: view.handle,
      displayName: view.displayName,
      avatar: view.avatar,
      viewer: view.viewer,
    }))

    return Array.isArray(result) ? views : views[0]
  }
}

type UserResult = DidHandle
