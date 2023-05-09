import { cborToLexRecord } from '@atproto/repo'
import Database from '../../../db'
import {
  FeedViewPost,
  PostView,
  SkeletonFeedPost,
  isPostView,
  isSkeletonReasonRepost,
} from '../../../lexicon/types/app/bsky/feed/defs'
import { ActorViewMap, FeedEmbeds, MaybePostView, PostInfoMap } from './types'
import { Labels } from '../label'

export * from './types'

export class FeedViews {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new FeedViews(db)
  }

  formatFeed(
    items: SkeletonFeedPost[],
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
  ): FeedViewPost[] {
    return items.map((item) => {
      const post = this.formatMaybePostView(
        item.post,
        actors,
        posts,
        embeds,
        labels,
      )
      if (!isPostView(post)) {
        return { post }
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
      return feedPost
    })
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
    return post
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
