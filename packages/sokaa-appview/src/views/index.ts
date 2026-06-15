import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { ids } from '../data-plane/server/indexing/collections'
import { Actor } from '../hydration/actor'
import { FeedItem, Post } from '../hydration/feed'
import { HydrationState } from '../hydration/hydrator'
import * as AppSokaaActorDefs from '../lexicon/types/app/sokaa/actor/defs'
import * as AppSokaaEmbedImages from '../lexicon/types/app/sokaa/embed/images'
import * as AppSokaaEmbedVideo from '../lexicon/types/app/sokaa/embed/video'
import * as AppSokaaFeedDefs from '../lexicon/types/app/sokaa/feed/defs'
import * as AppSokaaFeedPost from '../lexicon/types/app/sokaa/feed/post'
import { CdnUriBuilder } from './uri'

type Un$Typed<T> = Omit<T, '$type'>

export class Views {
  constructor(private cdnUriBuilder: CdnUriBuilder) {}

  actorIsTakendown(did: string, state: HydrationState): boolean {
    const actor = state.actors?.get(did)
    if (actor?.upstreamStatus === 'takendown') return true
    if (actor?.upstreamStatus === 'suspended') return true
    return false
  }

  profileBasic(
    did: string,
    state: HydrationState,
  ): Un$Typed<AppSokaaActorDefs.ProfileViewBasic> | undefined {
    const actor = state.actors?.get(did)
    if (!actor || !this.actorVisible(actor, state)) return
    return {
      did,
      handle: actor.handle ?? INVALID_HANDLE,
      displayName: actor.displayName,
      avatar: actor.avatarCid
        ? this.cdnUriBuilder.avatar(did, actor.avatarCid)
        : undefined,
    }
  }

  profile(
    did: string,
    state: HydrationState,
  ): Un$Typed<AppSokaaActorDefs.ProfileView> | undefined {
    const actor = state.actors?.get(did)
    if (!actor || !this.actorVisible(actor, state)) return
    const basic = this.profileBasic(did, state)
    if (!basic) return
    const viewer = state.profileViewers?.get(did)
    return {
      ...basic,
      description: actor.description,
      banner: actor.bannerCid
        ? this.cdnUriBuilder.banner(did, actor.bannerCid)
        : undefined,
      followersCount: actor.followersCount,
      postsCount: actor.postsCount,
      indexedAt: actor.indexedAt,
      viewer: viewer
        ? {
            following: viewer.following,
            followedBy: viewer.followedBy,
          }
        : undefined,
    }
  }

  post(
    uri: string,
    state: HydrationState,
  ): Un$Typed<AppSokaaFeedDefs.PostView> | undefined {
    const indexed = state.posts?.get(uri)
    if (!indexed) return
    const author = this.profileBasic(indexed.creator, state)
    if (!author) return
    const record = this.postRecord(indexed)
    if (!record) return
    const viewer = state.postViewers?.get(uri)
    return {
      uri,
      cid: indexed.cid,
      author,
      record,
      embed: this.embedView(
        indexed,
        state,
      ) as AppSokaaFeedDefs.PostView['embed'],
      likeCount: indexed.likeCount,
      indexedAt: indexed.indexedAt,
      viewer: viewer?.like ? { like: viewer.like } : undefined,
    }
  }

  feedViewPost(
    item: FeedItem,
    state: HydrationState,
  ): Un$Typed<AppSokaaFeedDefs.FeedViewPost> | undefined {
    const post = this.post(item.post.uri, state)
    if (!post) return
    return { post }
  }

  private actorVisible(actor: Actor, state: HydrationState): boolean {
    if (state.ctx?.includeTakedowns) return true
    return (actor.upstreamStatus ?? 'active') === 'active'
  }

  private postRecord(indexed: Post): AppSokaaFeedPost.Main | undefined {
    if (!indexed.mediaJson || typeof indexed.mediaJson !== 'object') {
      return undefined
    }
    const media = indexed.mediaJson as AppSokaaFeedPost.Main['media']
    return {
      $type: ids.AppSokaaFeedPost,
      caption: indexed.caption,
      media,
      createdAt: indexed.createdAt,
    }
  }

  private embedView(
    indexed: Post,
    _state: HydrationState,
  ): AppSokaaEmbedVideo.View | AppSokaaEmbedImages.View | undefined {
    const media = indexed.mediaJson
    if (!media || typeof media !== 'object') return
    const type = (media as { $type?: string }).$type
    const authorDid = indexed.creator

    if (type === ids.AppSokaaEmbedVideo) {
      const video = media as AppSokaaEmbedVideo.Main
      const videoCid = cidFromBlobRef(video.video)
      if (!videoCid) return
      const thumbCid = video.thumbnail
        ? cidFromBlobRef(video.thumbnail)
        : undefined
      return {
        $type: 'app.sokaa.embed.video#view',
        cid: videoCid,
        playlist: this.cdnUriBuilder.videoPlaylist(authorDid, videoCid),
        thumbnail: thumbCid
          ? this.cdnUriBuilder.videoThumbnail(authorDid, thumbCid)
          : undefined,
        alt: video.alt,
        duration: video.duration,
        aspectRatio: video.aspectRatio,
      }
    }

    if (type === ids.AppSokaaEmbedImages) {
      const images = media as AppSokaaEmbedImages.Main
      return {
        $type: 'app.sokaa.embed.images#view',
        images: images.images.map((image) => {
          const imageCid = cidFromBlobRef(image.image)
          const thumb = imageCid
            ? this.cdnUriBuilder.feedThumbnail(authorDid, imageCid)
            : ''
          const fullsize = imageCid
            ? this.cdnUriBuilder.feedFullsize(authorDid, imageCid)
            : ''
          return {
            $type: 'app.sokaa.embed.images#viewImage',
            thumb,
            fullsize,
            alt: image.alt,
            aspectRatio: image.aspectRatio,
          }
        }),
      }
    }

    return undefined
  }
}

const cidFromBlobRef = (ref: unknown): string | undefined => {
  if (!ref || typeof ref !== 'object') return
  const blob = ref as Record<string, unknown>
  if (blob['$type'] === 'blob') {
    const link = blob['ref'] as Record<string, unknown> | undefined
    return link?.['$link'] as string | undefined
  }
  if (typeof blob['ref'] === 'object' && blob['ref'] !== null) {
    const inner = blob['ref'] as Record<string, unknown>
    if (typeof inner['toString'] === 'function') {
      return inner.toString()
    }
  }
  return undefined
}

export { AtUri }
