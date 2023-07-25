import Database from '../../../db'
import {
  FeedViewPost,
  GeneratorView,
  PostView,
} from '../../../lexicon/types/app/bsky/feed/defs'
import {
  Main as EmbedImages,
  isMain as isEmbedImages,
  View as EmbedImagesView,
} from '../../../lexicon/types/app/bsky/embed/images'
import {
  Main as EmbedExternal,
  isMain as isEmbedExternal,
  View as EmbedExternalView,
} from '../../../lexicon/types/app/bsky/embed/external'
import { Main as EmbedRecordWithMedia } from '../../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  ViewBlocked,
  ViewNotFound,
  ViewRecord,
} from '../../../lexicon/types/app/bsky/embed/record'
import {
  ActorInfoMap,
  PostEmbedViews,
  FeedGenInfo,
  FeedRow,
  MaybePostView,
  PostInfoMap,
  RecordEmbedViewRecord,
  PostBlocksMap,
  FeedHydrationOptions,
} from './types'
import { Labels } from '../label'
import { ProfileView } from '../../../lexicon/types/app/bsky/actor/defs'
import { ImageUriBuilder } from '../../../image/uri'

export * from './types'

export class FeedViews {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedViews(db, imgUriBuilder)
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
        ? this.imgUriBuilder.getCommonSignedUri('avatar', info.avatarCid)
        : undefined,
      likeCount: info.likeCount,
      viewer: {
        like: info.viewerLike ?? undefined,
      },
      indexedAt: info.indexedAt,
    }
  }

  formatFeed(
    items: FeedRow[],
    actors: ActorInfoMap,
    posts: PostInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    blocks: PostBlocksMap,
    opts?: FeedHydrationOptions,
  ): FeedViewPost[] {
    const feed: FeedViewPost[] = []
    for (const item of items) {
      const post = this.formatPostView(
        item.postUri,
        actors,
        posts,
        embeds,
        labels,
        opts,
      )
      // skip over not found & blocked posts
      if (!post || blocks[post.uri]?.reply) {
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
          blocks,
          opts,
        )
        const replyRoot = this.formatMaybePostView(
          item.replyRoot,
          actors,
          posts,
          embeds,
          labels,
          blocks,
          opts,
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
    actors: ActorInfoMap,
    posts: PostInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    opts?: Pick<FeedHydrationOptions, 'includeSoftDeleted'>,
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
      takedownId: opts?.includeSoftDeleted
        ? post.takedownId ?? null
        : undefined,
      record: post.record,
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
    actors: ActorInfoMap,
    posts: PostInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    blocks: PostBlocksMap,
    opts?: FeedHydrationOptions,
  ): MaybePostView | undefined {
    const post = this.formatPostView(uri, actors, posts, embeds, labels, opts)
    if (!post) {
      if (!opts?.usePostViewUnion) return
      return this.notFoundPost(uri)
    }
    if (
      post.author.viewer?.blockedBy ||
      post.author.viewer?.blocking ||
      blocks[uri]?.reply
    ) {
      if (!opts?.usePostViewUnion) return
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

  imagesEmbedView(embed: EmbedImages) {
    const imgViews = embed.images.map((img) => ({
      thumb: this.imgUriBuilder.getCommonSignedUri(
        'feed_thumbnail',
        img.image.ref,
      ),
      fullsize: this.imgUriBuilder.getCommonSignedUri(
        'feed_fullsize',
        img.image.ref,
      ),
      alt: img.alt,
    }))
    return {
      $type: 'app.bsky.embed.images#view',
      images: imgViews,
    }
  }

  externalEmbedView(embed: EmbedExternal) {
    const { uri, title, description, thumb } = embed.external
    return {
      $type: 'app.bsky.embed.external#view',
      external: {
        uri,
        title,
        description,
        thumb: thumb
          ? this.imgUriBuilder.getCommonSignedUri('feed_thumbnail', thumb.ref)
          : undefined,
      },
    }
  }

  getRecordEmbedView(
    uri: string,
    post?: PostView,
    omitEmbeds = false,
  ): (ViewRecord | ViewNotFound | ViewBlocked) & { $type: string } {
    if (!post) {
      return {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri,
      }
    }
    if (post.author.viewer?.blocking || post.author.viewer?.blockedBy) {
      return {
        $type: 'app.bsky.embed.record#viewBlocked',
        uri,
      }
    }
    return {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: post.uri,
      cid: post.cid,
      author: post.author,
      value: post.record,
      labels: post.labels,
      indexedAt: post.indexedAt,
      embeds: omitEmbeds ? undefined : post.embed ? [post.embed] : [],
    }
  }

  getRecordWithMediaEmbedView(
    embed: EmbedRecordWithMedia,
    embedRecordView: RecordEmbedViewRecord,
  ) {
    let mediaEmbed: EmbedImagesView | EmbedExternalView
    if (isEmbedImages(embed.media)) {
      mediaEmbed = this.imagesEmbedView(embed.media)
    } else if (isEmbedExternal(embed.media)) {
      mediaEmbed = this.externalEmbedView(embed.media)
    } else {
      return
    }
    return {
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: {
        record: embedRecordView,
      },
      media: mediaEmbed,
    }
  }
}
