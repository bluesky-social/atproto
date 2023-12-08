import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import { ImageUriBuilder } from '../image/uri'
import { HydrationState } from '../hydration/hydrator'
import { ids } from '../lexicon/lexicons'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../lexicon/types/app/bsky/actor/defs'
import {
  GeneratorView,
  PostView,
  ThreadgateView,
} from '../lexicon/types/app/bsky/feed/defs'
import { ListView, ListViewBasic } from '../lexicon/types/app/bsky/graph/defs'
import { compositeTime, creatorFromUri } from './util'
import { mapDefined } from '@atproto/common'
import { isListRule } from '../lexicon/types/app/bsky/feed/threadgate'
import { isSelfLabels } from '../lexicon/types/com/atproto/label/defs'
import {
  Embed,
  EmbedBlocked,
  EmbedNotFound,
  EmbedView,
  ExternalEmbed,
  ExternalEmbedView,
  ImagesEmbed,
  ImagesEmbedView,
  PostEmbedView,
  RecordEmbed,
  RecordEmbedView,
  RecordWithMedia,
  RecordWithMediaView,
  isExternalEmbed,
  isImagesEmbed,
  isRecordEmbed,
  isRecordWithMedia,
} from './types'
import { Label } from '../hydration/label'

export class Views {
  constructor(public imgUriBuilder: ImageUriBuilder) {}

  // Actor
  // ------------

  actorIsTakendown(did: string, state: HydrationState): boolean {
    return state.actors?.get(did)?.takendown ?? false
  }

  viewerBlockExists(did: string, state: HydrationState): boolean {
    const actor = state.profileViewers?.get(did)
    if (!actor) return false
    return (
      !!actor.blockedBy ||
      !!actor.blocking ||
      !!actor.blockedByList ||
      !!actor.blockingByList
    )
  }

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
      ...this.selfLabels({
        uri: profileUri,
        cid: actor.profileCid?.toString(),
        record: actor.profile,
      }),
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

  // Labels
  // ------------

  selfLabels(details: {
    uri?: string
    cid?: string
    record?: Record<string, unknown>
  }): Label[] {
    const { uri, cid, record } = details
    if (!uri || !cid || !record) return []
    if (!isSelfLabels(record.labels)) return []
    const src = new AtUri(uri).host // record creator
    const cts =
      typeof record.createdAt === 'string'
        ? normalizeDatetimeAlways(record.createdAt)
        : new Date(0).toISOString()
    return record.labels.values.map(({ val }) => {
      return { src, uri, cid, val, cts, neg: false }
    })
  }

  // Feed
  // ------------

  feedGenerator(uri: string, state: HydrationState): GeneratorView | undefined {
    const feedgen = state.feedgens?.get(uri)
    if (!feedgen) return
    const creatorDid = creatorFromUri(uri)
    const creator = this.profile(creatorDid, state)
    if (!creator) return
    const viewer = state.feedgenViewers?.get(uri)
    const aggs = state.feedgenAggs?.get(uri)

    return {
      uri,
      cid: feedgen.cid.toString(),
      did: feedgen.record.did,
      creator,
      displayName: feedgen.record.displayName,
      description: feedgen.record.description,
      descriptionFacets: feedgen.record.descriptionFacets,
      avatar: feedgen.record.avatar
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            creatorDid,
            feedgen.record.avatar.ref,
          )
        : undefined,
      likeCount: aggs?.likes,
      viewer: viewer
        ? {
            like: viewer.like,
          }
        : undefined,
      indexedAt: compositeTime(
        feedgen.record.createdAt,
        feedgen.indexedAt?.toISOString(),
      ),
    }
  }

  threadGate(uri: string, state: HydrationState): ThreadgateView | undefined {
    const gate = state.threadgates?.get(uri)
    if (!gate) return
    return {
      uri,
      cid: gate.cid.toString(),
      record: gate.record,
      lists: mapDefined(gate.record.allow ?? [], (rule) => {
        if (!isListRule(rule)) return
        return this.listBasic(rule.list, state)
      }),
    }
  }

  post(uri: string, state: HydrationState): PostView | undefined {
    const post = state.posts?.get(uri)
    if (!post) return
    const parsedUri = new AtUri(uri)
    const authorDid = parsedUri.hostname
    const author = this.profileBasic(authorDid, state)
    if (!author) return
    const aggs = state.postAggs?.get(uri)
    const viewer = state.postViewers?.get(uri)
    const gateUri = AtUri.make(
      authorDid,
      ids.AppBskyFeedThreadgate,
      parsedUri.rkey,
    ).toString()
    return {
      uri,
      cid: post.cid.toString(),
      author,
      record: post.record,
      embed: post.record.embed
        ? this.embed(authorDid, post.record.embed, state)
        : undefined,
      replyCount: aggs?.replies,
      repostCount: aggs?.reposts,
      likeCount: aggs?.likes,
      indexedAt: compositeTime(
        post.record.createdAt,
        post.indexedAt?.toISOString(),
      ),
      viewer: viewer
        ? {
            repost: viewer.repost,
            like: viewer.like,
            replyDisabled: this.userReplyDisabled(uri, state),
          }
        : undefined,
      labels: state.labels?.get(uri) ?? undefined,
      threadgate: !post.record.reply // only hydrate gate on root post
        ? this.threadGate(gateUri, state)
        : undefined,
    }
  }

  // Embeds
  // ------------

  embed(
    did: string,
    embed: Embed | { $type: string },
    state: HydrationState,
  ): EmbedView | undefined {
    if (isImagesEmbed(embed)) {
      return this.imagesEmbed(did, embed)
    } else if (isExternalEmbed(embed)) {
      return this.externalEmbed(did, embed)
    } else if (isRecordEmbed(embed)) {
      return this.recordEmbed(embed, state)
    } else if (isRecordWithMedia(embed)) {
      return this.recordWithMediaEmbed(did, embed, state)
    } else {
      return undefined
    }
  }

  imagesEmbed(did: string, embed: ImagesEmbed): ImagesEmbedView {
    const imgViews = embed.images.map((img) => ({
      thumb: this.imgUriBuilder.getPresetUri(
        'feed_thumbnail',
        did,
        img.image.ref,
      ),
      fullsize: this.imgUriBuilder.getPresetUri(
        'feed_fullsize',
        did,
        img.image.ref,
      ),
      alt: img.alt,
      aspectRatio: img.aspectRatio,
    }))
    return {
      $type: 'app.bsky.embed.images#view',
      images: imgViews,
    }
  }

  externalEmbed(did: string, embed: ExternalEmbed): ExternalEmbedView {
    const { uri, title, description, thumb } = embed.external
    return {
      $type: 'app.bsky.embed.external#view',
      external: {
        uri,
        title,
        description,
        thumb: thumb
          ? this.imgUriBuilder.getPresetUri('feed_thumbnail', did, thumb.ref)
          : undefined,
      },
    }
  }

  embedNotFound(uri: string): { record: EmbedNotFound } {
    return {
      record: {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri,
        notFound: true,
      },
    }
  }

  embedBlocked(uri: string, author: ProfileView): { record: EmbedBlocked } {
    return {
      record: {
        $type: 'app.bsky.embed.record#viewBlocked',
        uri,
        blocked: true,
        author: {
          did: author.did,
          viewer: author.viewer
            ? {
                blockedBy: author.viewer?.blockedBy,
                blocking: author.viewer?.blocking,
              }
            : undefined,
        },
      },
    }
  }

  embedPostView(uri: string, state: HydrationState): PostEmbedView | undefined {
    const postView = this.post(uri, state)
    if (!postView) return
    return {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: postView.uri,
      cid: postView.cid,
      author: postView.author,
      value: postView.record,
      labels: postView.labels,
      indexedAt: postView.indexedAt,
      // @TODO
      // embeds: postView.embed,
    }
  }

  recordEmbed(embed: RecordEmbed, state: HydrationState): RecordEmbedView {
    const uri = embed.record.uri
    const parsedUri = new AtUri(uri)
    if (parsedUri.collection === ids.AppBskyFeedPost) {
      const view = this.embedPostView(uri, state)
      if (!view) return this.embedNotFound(uri)
      if (view.author.viewer?.blockedBy || view.author.viewer?.blocking) {
        return this.embedBlocked(uri, view.author)
      }
      return { record: view }
    } else if (parsedUri.collection === ids.AppBskyFeedGenerator) {
      const view = this.feedGenerator(uri, state)
      if (!view) return this.embedNotFound(uri)
      if (view.creator.viewer?.blockedBy || view.creator.viewer?.blocking) {
        return this.embedBlocked(uri, view.creator)
      }
      return { record: view }
    } else if (parsedUri.collection === ids.AppBskyGraphList) {
      const view = this.list(uri, state)
      if (!view) return this.embedNotFound(uri)
      if (view.creator.viewer?.blockedBy || view.creator.viewer?.blocking) {
        return this.embedBlocked(uri, view.creator)
      }
      return { record: view }
    }
    return this.embedNotFound(uri)
  }

  recordWithMediaEmbed(
    did: string,
    embed: RecordWithMedia,
    state: HydrationState,
  ): RecordWithMediaView | undefined {
    let mediaEmbed: ImagesEmbedView | ExternalEmbedView
    if (isImagesEmbed(embed.media)) {
      mediaEmbed = this.imagesEmbed(did, embed.media)
    } else if (isExternalEmbed(embed.media)) {
      mediaEmbed = this.externalEmbed(did, embed.media)
    } else {
      return
    }
    return {
      $type: 'app.bsky.embed.recordWithMedia#view',
      media: mediaEmbed,
      record: this.recordEmbed(embed.record, state),
    }
  }

  userReplyDisabled(_uri: string, _state: HydrationState): boolean | undefined {
    // @TODO
    return undefined
  }
}
