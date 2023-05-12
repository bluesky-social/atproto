import { cborToLexRecord } from '@atproto/repo'
import Database from '../../../db'
import {
  FeedViewPost,
  GeneratorView,
  PostView,
  SkeletonFeedPost,
  isSkeletonReasonRepost,
} from '../../../lexicon/types/app/bsky/feed/defs'
import { ActorViewMap, FeedEmbeds, MaybePostView, PostInfoMap } from './types'
import { Labels } from '../label'
import { FeedGenerator } from '../../db/tables/feed-generator'
import { ProfileView } from '../../../lexicon/types/app/bsky/actor/defs'
import { ImageUriBuilder } from '../../../image/uri'

export * from './types'

export class FeedViews {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedViews(db, imgUriBuilder)
  }

  formatFeedGeneratorView(
    info: FeedGeneratorInfo,
    profiles: Record<string, ProfileView>,
  ): GeneratorView {
    return {
      uri: info.uri,
      did: info.feedDid,
      creator: profiles[info.creator],
      displayName: info.displayName ?? undefined,
      description: info.description ?? undefined,
      descriptionFacets: info.descriptionFacets
        ? JSON.parse(info.descriptionFacets)
        : undefined,
      avatar: info.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri('avatar', info.avatarCid)
        : undefined,
      viewer: {
        subscribed: !!info.viewerSubscribed,
        like: info.viewerLike ?? undefined,
      },
      indexedAt: info.indexedAt,
    }
  }

  formatFeed(
    items: SkeletonFeedPost[],
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
  ): FeedViewPost[] {
    const feed: FeedViewPost[] = []
    for (const item of items) {
      const post = this.formatPostView(item.post, actors, posts, embeds, labels)
      // skip over not found & blocked posts
      if (!post) {
        continue
      }
      const feedPost = { post }
      if (item.reason && isSkeletonReasonRepost(item.reason)) {
        const originator = actors[item.reason.by]
        if (originator) {
          feedPost['reason'] = {
            $type: 'app.bsky.feed.defs#reasonRepost',
            by: originator,
            indexedAt: item.reason.indexedAt,
          }
        }
      }
      if (item.replyTo) {
        const replyParent = this.formatMaybePostView(
          item.replyTo.parent,
          actors,
          posts,
          embeds,
          labels,
        )
        const replyRoot = this.formatMaybePostView(
          item.replyTo.root,
          actors,
          posts,
          embeds,
          labels,
        )
        if (replyRoot && replyParent) {
          feedPost['reply'] = {
            root: replyRoot,
            parent: replyParent,
          }
        }
      }
      feed.push(feedPost)
    }
    return feed
  }

  formatPostView(
    uri: string,
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
  ): PostView | undefined {
    const post = posts[uri]
    const author = actors[post?.creator]
    if (!post || !author) return undefined
    return {
      uri: post.uri,
      cid: post.cid,
      author: author,
      record: cborToLexRecord(post.recordBytes),
      embed: embeds[uri],
      replyCount: post.replyCount ?? 0,
      repostCount: post.repostCount ?? 0,
      likeCount: post.likeCount ?? 0,
      indexedAt: post.indexedAt,
      viewer: {
        repost: post.requesterRepost ?? undefined,
        like: post.requesterLike ?? undefined,
      },
      labels: labels[uri] ?? [],
    }
  }

  formatMaybePostView(
    uri: string,
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
  ): MaybePostView {
    const post = this.formatPostView(uri, actors, posts, embeds, labels)
    if (!post) return this.notFoundPost(uri)
    if (post.author.viewer?.blockedBy || post.author.viewer?.blocking) {
      return this.blockedPost(uri)
    }
    return {
      $type: 'app.bsky.feed.defs#postView',
      ...post,
    }
  }

  blockedPost(uri: string) {
    return {
      $type: 'app.bsky.feed.defs#blockedPost',
      uri: uri,
      blocked: true as const,
    }
  }

  notFoundPost(uri: string) {
    return {
      $type: 'app.bsky.feed.defs#notFoundPost',
      uri: uri,
      notFound: true as const,
    }
  }
}

type FeedGeneratorInfo = FeedGenerator & {
  viewerLike?: string
  viewerSubscribed?: string
}
