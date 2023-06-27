import Database from '../../db'
import {
  FeedViewPost,
  GeneratorView,
  PostView,
} from '../../lexicon/types/app/bsky/feed/defs'
import { ProfileView } from '../../lexicon/types/app/bsky/actor/defs'
import { FeedGenInfo, MaybePostView } from './types'
import { Labels } from '../label'
import { ImageUriBuilder } from '../../image/uri'
import { ActorViewMap, FeedEmbeds, FeedRow, PostInfoMap } from '../types'
import { jsonStringToLex } from '@atproto/lexicon'

export class FeedViews {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedViews(db, imgUriBuilder)
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
    // If the author labels are not hydrated yet, attempt to pull them
    // from labels: e.g. compatible with hydrateFeed() batching label hydration.
    author.labels ??= labels[author.did] ?? []
    return {
      uri: post.uri,
      cid: post.cid,
      author: author,
      record: jsonStringToLex(post.recordJson) as Record<string, unknown>,
      embed: embeds[uri],
      replyCount: post.replyCount ?? 0,
      repostCount: post.repostCount ?? 0,
      likeCount: post.likeCount ?? 0,
      indexedAt: post.indexedAt,
      viewer: post.viewer
        ? {
            repost: post.requesterRepost ?? undefined,
            like: post.requesterLike ?? undefined,
          }
        : undefined,
      labels: labels[uri] ?? [],
    }
  }

  formatFeed(
    items: FeedRow[],
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
    usePostViewUnion?: boolean,
  ): FeedViewPost[] {
    const feed: FeedViewPost[] = []
    for (const item of items) {
      const post = this.formatPostView(
        item.postUri,
        actors,
        posts,
        embeds,
        labels,
      )
      // skip over not found & blocked posts
      if (!post) {
        continue
      }
      const feedPost = { post }
      if (item.type === 'repost') {
        const originator = actors[item.originatorDid]
        // skip over reposts where we don't have reposter profile
        if (!originator) {
          continue
        } else {
          feedPost['reason'] = {
            $type: 'app.bsky.feed.defs#reasonRepost',
            by: {
              ...originator,
              labels: labels[item.originatorDid] ?? [],
            },
            indexedAt: item.sortAt,
          }
        }
      }
      if (item.replyParent && item.replyRoot) {
        const replyParent = this.formatMaybePostView(
          item.replyParent,
          actors,
          posts,
          embeds,
          labels,
          usePostViewUnion,
        )
        const replyRoot = this.formatMaybePostView(
          item.replyRoot,
          actors,
          posts,
          embeds,
          labels,
          usePostViewUnion,
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

  formatFeedGeneratorView(
    info: FeedGenInfo,
    profiles: Record<string, ProfileView>,
    labels?: Labels,
  ): GeneratorView {
    const profile = profiles[info.creator]
    if (profile) {
      // If the creator labels are not hydrated yet, attempt to pull them
      // from labels: e.g. compatible with embedsForPosts() batching label hydration.
      profile.labels ??= labels?.[info.creator] ?? []
    }
    return {
      uri: info.uri,
      cid: info.cid,
      did: info.feedDid,
      creator: profile,
      displayName: info.displayName ?? undefined,
      description: info.description ?? undefined,
      descriptionFacets: info.descriptionFacets
        ? JSON.parse(info.descriptionFacets)
        : undefined,
      avatar: info.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            info.creator,
            info.avatarCid,
          )
        : undefined,
      likeCount: info.likeCount,
      viewer: {
        like: info.viewerLike ?? undefined,
      },
      indexedAt: info.sortAt,
    }
  }

  // @TODO present block here (w/ usePostViewUnion)
  formatMaybePostView(
    uri: string,
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
    labels: Labels,
    usePostViewUnion?: boolean,
  ): MaybePostView | undefined {
    const post = this.formatPostView(uri, actors, posts, embeds, labels)
    if (!post) {
      if (!usePostViewUnion) return
      return this.notFoundPost(uri)
    }
    if (post.author.viewer?.blockedBy || post.author.viewer?.blocking) {
      if (!usePostViewUnion) return
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
