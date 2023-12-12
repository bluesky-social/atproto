import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import { ImageUriBuilder } from '../image/uri'
import { HydrationState } from '../hydration/hydrator'
import { ids } from '../lexicon/lexicons'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
  ViewerState as ProfileViewerState,
} from '../lexicon/types/app/bsky/actor/defs'
import {
  BlockedPost,
  FeedViewPost,
  GeneratorView,
  NotFoundPost,
  PostView,
  ReasonRepost,
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
  MaybePostView,
  PostEmbedView,
  RecordEmbed,
  RecordEmbedView,
  RecordEmbedViewInternal,
  RecordWithMedia,
  RecordWithMediaView,
  isExternalEmbed,
  isImagesEmbed,
  isRecordEmbed,
  isRecordWithMedia,
} from './types'
import { Label } from '../hydration/label'
import { Repost } from '../hydration/feed'

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

  viewerMuteExists(did: string, state: HydrationState): boolean {
    const actor = state.profileViewers?.get(did)
    if (!actor) return false
    return actor.muted || !!actor.mutedByList
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
      viewer: this.profileViewer(did, state),
      labels,
    }
  }

  profileViewer(
    did: string,
    state: HydrationState,
  ): ProfileViewerState | undefined {
    const viewer = state.profileViewers?.get(did)
    if (!viewer) return
    const blockedByUri = viewer.blockedBy || viewer.blockedByList
    const blockingUri = viewer.blocking || viewer.blockingByList
    const block = !!blockedByUri || !!blockingUri
    return {
      muted: viewer.muted || !!viewer.mutedByList,
      mutedByList: viewer.mutedByList
        ? this.listBasic(viewer.mutedByList, state)
        : undefined,
      blockedBy: !!blockedByUri,
      blocking: blockingUri,
      blockingByList: viewer.blockingByList
        ? this.listBasic(viewer.blockingByList, state)
        : undefined,
      following: viewer.following && !block ? viewer.following : undefined,
      followedBy: viewer.followedBy && !block ? viewer.followedBy : undefined,
    }
  }

  // Graph
  // ------------

  list(uri: string, state: HydrationState): ListView | undefined {
    const creatorDid = new AtUri(uri).hostname
    const list = state.lists?.get(uri)
    if (!list) return
    const creator = this.profile(creatorDid, state)
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

  feedItemBlocksAndMutes(
    uri: string,
    state: HydrationState,
  ): {
    originatorMuted: boolean
    originatorBlocked: boolean
    authorMuted: boolean
    authorBlocked: boolean
  } {
    const parsed = new AtUri(uri)
    if (parsed.collection === ids.AppBskyFeedRepost) {
      const repost = state.reposts?.get(uri)
      const postUri = repost?.record.subject.uri
      const postDid = postUri ? creatorFromUri(postUri) : undefined
      return {
        originatorMuted: this.viewerMuteExists(parsed.hostname, state),
        originatorBlocked: this.viewerBlockExists(parsed.hostname, state),
        authorMuted: !!postDid && this.viewerMuteExists(postDid, state),
        authorBlocked: !!postDid && this.viewerBlockExists(postDid, state),
      }
    } else {
      return {
        originatorMuted: this.viewerMuteExists(parsed.hostname, state),
        originatorBlocked: this.viewerBlockExists(parsed.hostname, state),
        authorMuted: this.viewerMuteExists(parsed.hostname, state),
        authorBlocked: this.viewerBlockExists(parsed.hostname, state),
      }
    }
  }

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

  post(uri: string, state: HydrationState, depth = 0): PostView | undefined {
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
    const labels = [
      ...(state.labels?.get(uri) ?? []),
      ...this.selfLabels({
        uri,
        cid: post.cid.toString(),
        record: post.record,
      }),
    ]
    return {
      uri,
      cid: post.cid.toString(),
      author,
      record: post.record,
      embed:
        depth < 2 && post.record.embed
          ? this.embed(authorDid, post.record.embed, state, depth + 1)
          : undefined,
      replyCount: aggs?.replies,
      repostCount: aggs?.reposts,
      likeCount: aggs?.likes,
      indexedAt: (post.indexedAt ?? new Date()).toISOString(),
      viewer: viewer
        ? {
            repost: viewer.repost,
            like: viewer.like,
            replyDisabled: this.userReplyDisabled(uri, state),
          }
        : undefined,
      labels,
      threadgate: !post.record.reply // only hydrate gate on root post
        ? this.threadGate(gateUri, state)
        : undefined,
    }
  }

  feedViewPost(uri: string, state: HydrationState): FeedViewPost | undefined {
    const parsedUri = new AtUri(uri)
    let postUri: AtUri
    let reason: ReasonRepost | undefined
    if (parsedUri.collection === ids.AppBskyFeedRepost) {
      const repost = state.reposts?.get(uri)
      if (!repost) return
      reason = this.reasonRepost(parsedUri.hostname, repost, state)
      if (!reason) return
      postUri = new AtUri(repost.record.subject.uri)
    } else {
      postUri = parsedUri
    }
    const post = this.post(postUri.toString(), state)
    if (!post) return
    return {
      post,
      reason,
      reply: this.replyRef(postUri.toString(), state),
    }
  }

  replyRef(uri: string, state: HydrationState, usePostViewUnion = false) {
    const postRecord = state.posts?.get(uri.toString())?.record
    if (!postRecord?.reply) return
    const root = this.maybePost(
      postRecord.reply.root.uri,
      state,
      usePostViewUnion,
    )
    const parent = this.maybePost(
      postRecord.reply.parent.uri,
      state,
      usePostViewUnion,
    )
    if ((root || parent) && !(root && parent)) {
      console.log('HERE')
      console.log(postRecord.reply)
      const parentPost = this.post(postRecord.reply.parent.uri, state)
      console.log(parentPost)
      const rootRecord = state.posts?.get(postRecord.reply.root.uri)
      console.log(rootRecord)
      const parentRecord = state.posts?.get(postRecord.reply.parent.uri)
      console.log(parentRecord)
    }
    return root && parent ? { root, parent } : undefined
  }

  maybePost(
    uri: string,
    state: HydrationState,
    usePostViewUnion = false,
  ): MaybePostView | undefined {
    const post = this.post(uri, state)
    if (!post) return usePostViewUnion ? this.notFoundPost(uri) : undefined
    if (this.viewerBlockExists(post.author.did, state)) {
      return usePostViewUnion
        ? this.blockedPost(uri, post.author.did, state)
        : undefined
    }
    return {
      $type: 'app.bsky.feed.defs#postView',
      ...post,
    }
  }

  blockedPost(
    uri: string,
    authorDid: string,
    state: HydrationState,
  ): BlockedPost {
    return {
      $type: 'app.bsky.feed.defs#blockedPost',
      uri,
      blocked: true,
      author: {
        did: authorDid,
        viewer: this.profileViewer(authorDid, state),
      },
    }
  }

  notFoundPost(uri: string): NotFoundPost {
    return {
      $type: 'app.bsky.feed.defs#notFoundPost',
      uri,
      notFound: true,
    }
  }

  reasonRepost(
    creatorDid: string,
    repost: Repost,
    state: HydrationState,
  ): ReasonRepost | undefined {
    const creator = this.profileBasic(creatorDid, state)
    if (!creator) return
    if (!repost.indexedAt) return
    return {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: creator,
      indexedAt: repost.indexedAt.toISOString(),
    }
  }

  // Embeds
  // ------------

  embed(
    did: string,
    embed: Embed | { $type: string },
    state: HydrationState,
    depth: number,
  ): EmbedView | undefined {
    if (isImagesEmbed(embed)) {
      return this.imagesEmbed(did, embed)
    } else if (isExternalEmbed(embed)) {
      return this.externalEmbed(did, embed)
    } else if (isRecordEmbed(embed)) {
      return this.recordEmbed(embed, state, depth)
    } else if (isRecordWithMedia(embed)) {
      return this.recordWithMediaEmbed(did, embed, state, depth)
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

  embedNotFound(uri: string): { $type: string; record: EmbedNotFound } {
    return {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri,
        notFound: true,
      },
    }
  }

  embedBlocked(
    uri: string,
    author: ProfileView,
  ): { $type: string; record: EmbedBlocked } {
    return {
      $type: 'app.bsky.embed.record#view',
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

  embedPostView(
    uri: string,
    state: HydrationState,
    depth: number,
  ): PostEmbedView | undefined {
    const postView = this.post(uri, state, depth)
    if (!postView) return
    return {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: postView.uri,
      cid: postView.cid,
      author: postView.author,
      value: postView.record,
      labels: postView.labels,
      indexedAt: postView.indexedAt,
      embeds: depth > 1 ? undefined : postView.embed ? [postView.embed] : [],
    }
  }

  recordEmbed(
    embed: RecordEmbed,
    state: HydrationState,
    depth: number,
    withTypeTag = true,
  ): RecordEmbedView {
    const uri = embed.record.uri
    const parsedUri = new AtUri(uri)
    if (parsedUri.collection === ids.AppBskyFeedPost) {
      const view = this.embedPostView(uri, state, depth)
      if (!view) return this.embedNotFound(uri)
      if (view.author.viewer?.blockedBy || view.author.viewer?.blocking) {
        return this.embedBlocked(uri, view.author)
      }
      return this.recordEmbedWrapper(view, withTypeTag)
    } else if (parsedUri.collection === ids.AppBskyFeedGenerator) {
      const view = this.feedGenerator(uri, state)
      if (!view) return this.embedNotFound(uri)
      view.$type = 'app.bsky.feed.defs#generatorView'
      if (view.creator.viewer?.blockedBy || view.creator.viewer?.blocking) {
        return this.embedBlocked(uri, view.creator)
      }
      return this.recordEmbedWrapper(view, withTypeTag)
    } else if (parsedUri.collection === ids.AppBskyGraphList) {
      const view = this.list(uri, state)
      if (!view) return this.embedNotFound(uri)
      view.$type = 'app.bsky.graph.defs#listView'
      if (view.creator.viewer?.blockedBy || view.creator.viewer?.blocking) {
        return this.embedBlocked(uri, view.creator)
      }
      return this.recordEmbedWrapper(view, withTypeTag)
    }
    return this.embedNotFound(uri)
  }

  private recordEmbedWrapper(
    record: RecordEmbedViewInternal,
    withTypeTag: boolean,
  ): RecordEmbedView {
    return {
      $type: withTypeTag ? 'app.bsky.embed.record#view' : undefined,
      record,
    }
  }

  recordWithMediaEmbed(
    did: string,
    embed: RecordWithMedia,
    state: HydrationState,
    depth: number,
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
      record: this.recordEmbed(embed.record, state, depth, false),
    }
  }

  userReplyDisabled(_uri: string, _state: HydrationState): boolean | undefined {
    // @TODO
    return undefined
  }
}
