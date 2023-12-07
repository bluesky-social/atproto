import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { ImageUriBuilder } from '../image/uri'
import { HydrationState } from '../hydration/hydrator'
import { ids } from '../lexicon/lexicons'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../lexicon/types/app/bsky/actor/defs'
import { ListView, ListViewBasic } from '../lexicon/types/app/bsky/graph/defs'
import { compositeTime } from './util'

export class Views {
  constructor(public imgUriBuilder: ImageUriBuilder) {}

  // Actor
  // ------------

  profileDetailed(
    did: string,
    state: HydrationState,
  ): ProfileViewDetailed | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const baseView = this.profile(did, state)
    if (!baseView) return
    const profileAggs = state.profileAggs?.get(did)
    return {
      ...baseView,
      banner: actor.profile?.banner
        ? this.imgUriBuilder.getPresetUri(
            'banner',
            did,
            actor.profile.banner.ref,
          )
        : undefined,
      followersCount: profileAggs?.followers,
      followsCount: profileAggs?.follows,
      postsCount: profileAggs?.posts,
    }
  }

  profile(did: string, state: HydrationState): ProfileView | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const basicView = this.profileBasic(did, state)
    if (!basicView) return
    return {
      ...basicView,
      description: actor.profile?.description,
      indexedAt: actor.indexedAt?.toISOString(),
    }
  }

  profileBasic(
    did: string,
    state: HydrationState,
  ): ProfileViewBasic | undefined {
    const actor = state.actors?.get(did)
    if (!actor) return
    const viewer = state.profileViewers?.get(did)
    const profileUri = AtUri.make(
      did,
      ids.AppBskyActorProfile,
      'self',
    ).toString()
    const labels = [
      ...(state.labels?.get(did) ?? []),
      ...(state.labels?.get(profileUri) ?? []),
    ]
    return {
      did,
      handle: actor.handle ?? INVALID_HANDLE,
      displayName: actor.profile?.displayName,
      avatar: actor.profile?.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            did,
            actor.profile.avatar.ref,
          )
        : undefined,
      viewer: viewer
        ? {
            muted: viewer.muted,
            mutedByList: viewer.mutedByList
              ? this.listBasic(viewer.mutedByList, state)
              : undefined,
            blockedBy: !!viewer.blockedBy,
            blocking: viewer.blocking,
            // @TODO blockedByList?
            blockingByList: viewer.blockingByList
              ? this.listBasic(viewer.blockingByList, state)
              : undefined,
            following: viewer.following,
            followedBy: viewer.followedBy,
          }
        : undefined,
      labels,
    }
  }

  // Graph
  // ------------

  list(uri: string, state: HydrationState): ListView | undefined {
    const creatorDid = new AtUri(uri).hostname
    const list = state.lists?.get(uri)
    if (!list) return
    const creator = this.profileBasic(creatorDid, state)
    if (!creator) return
    const basicView = this.listBasic(uri, state)
    if (!basicView) return

    return {
      ...basicView,
      creator,
      description: list.record.description,
      descriptionFacets: list.record.descriptionFacets,
      indexedAt: compositeTime(
        list.record.createdAt,
        list.indexedAt?.toISOString(),
      ),
    }
  }

  listBasic(uri: string, state: HydrationState): ListViewBasic | undefined {
    const list = state.lists?.get(uri)
    if (!list) {
      return undefined
    }
    const listViewer = state.listViewers?.get(uri)
    const creator = new AtUri(uri).hostname
    return {
      uri,
      cid: list.cid.toString(),
      name: list.record.name,
      purpose: list.record.purpose,
      avatar: list.record.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            creator,
            list.record.avatar.ref,
          )
        : undefined,
      indexedAt: compositeTime(
        list.record.createdAt,
        list.indexedAt?.toISOString(),
      ),
      viewer: listViewer
        ? {
            muted: !!listViewer.viewerMuted,
            blocked: listViewer.viewerListBlockUri,
          }
        : undefined,
    }
  }
}
