import { Database } from '../../db'
import {
  FeedViewPost,
  GeneratorView,
  PostView,
} from '../../lexicon/types/app/bsky/feed/defs'
import {
  Main as EmbedImages,
  isMain as isEmbedImages,
  View as EmbedImagesView,
} from '../../lexicon/types/app/bsky/embed/images'
import {
  Main as EmbedExternal,
  isMain as isEmbedExternal,
  View as EmbedExternalView,
} from '../../lexicon/types/app/bsky/embed/external'
import { Main as EmbedRecordWithMedia } from '../../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  ViewBlocked,
  ViewNotFound,
  ViewRecord,
} from '../../lexicon/types/app/bsky/embed/record'
import {
  PostEmbedViews,
  FeedGenInfo,
  FeedRow,
  MaybePostView,
  PostInfoMap,
  RecordEmbedViewRecord,
  PostBlocksMap,
  FeedHydrationState,
} from './types'
import { Labels, getSelfLabels } from '../label'
import { ImageUriBuilder } from '../../image/uri'
import { LabelCache } from '../../label-cache'
import { ActorInfoMap, ActorService } from '../actor'

export class FeedViews {
  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    public labelCache: LabelCache,
  ) {}

  static creator(imgUriBuilder: ImageUriBuilder, labelCache: LabelCache) {
    return (db: Database) => new FeedViews(db, imgUriBuilder, labelCache)
  }

  services = {
    actor: ActorService.creator(this.imgUriBuilder, this.labelCache)(this.db),
  }

  formatFeedGeneratorView(
    info: FeedGenInfo,
    profiles: ActorInfoMap,
  ): GeneratorView {
    const profile = profiles[info.creator]
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
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            info.creator,
            info.avatarCid,
          )
        : undefined,
      likeCount: info.likeCount,
      viewer: info.viewer
        ? {
            like: info.viewer.like ?? undefined,
          }
        : undefined,
      indexedAt: info.indexedAt,
    }
  }

  formatFeed(
    items: FeedRow[],
    state: FeedHydrationState,
    opts?: {
      viewer?: string | null
      usePostViewUnion?: boolean
    },
  ): FeedViewPost[] {
    const { posts, profiles, blocks, embeds, labels } = state
    const actors = this.services.actor.views.profileBasicPresentation(
      Object.keys(profiles),
      state,
      opts,
    )
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
            by: originator,
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
  ): PostView | undefined {
    const post = posts[uri]
    const author = actors[post?.creator]
    if (!post || !author) return undefined
    const postLabels = labels[uri] ?? []
    const postSelfLabels = getSelfLabels({
      uri: post.uri,
      cid: post.cid,
      record: post.record,
    })
    return {
      uri: post.uri,
      cid: post.cid,
      author: author,
      record: post.record,
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
      labels: [...postLabels, ...postSelfLabels],
    }
  }

  formatMaybePostView(
    uri: string,
    actors: ActorInfoMap,
    posts: PostInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    blocks: PostBlocksMap,
    opts?: {
      usePostViewUnion?: boolean
    },
  ): MaybePostView | undefined {
    const post = this.formatPostView(uri, actors, posts, embeds, labels)
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
      return this.blockedPost(post)
    }
    return {
      $type: 'app.bsky.feed.defs#postView',
      ...post,
    }
  }

  blockedPost(post: PostView) {
    return {
      $type: 'app.bsky.feed.defs#blockedPost',
      uri: post.uri,
      blocked: true as const,
      author: {
        did: post.author.did,
        viewer: post.author.viewer
          ? {
              blockedBy: post.author.viewer?.blockedBy,
              blocking: post.author.viewer?.blocking,
            }
          : undefined,
      },
    }
  }

  notFoundPost(uri: string) {
    return {
      $type: 'app.bsky.feed.defs#notFoundPost',
      uri: uri,
      notFound: true as const,
    }
  }

  imagesEmbedView(did: string, embed: EmbedImages) {
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

  externalEmbedView(did: string, embed: EmbedExternal) {
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

  getRecordEmbedView(
    uri: string,
    post?: PostView,
    omitEmbeds = false,
  ): (ViewRecord | ViewNotFound | ViewBlocked) & { $type: string } {
    if (!post) {
      return {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri,
        notFound: true,
      }
    }
    if (post.author.viewer?.blocking || post.author.viewer?.blockedBy) {
      return {
        $type: 'app.bsky.embed.record#viewBlocked',
        uri,
        blocked: true,
        author: {
          did: post.author.did,
          viewer: post.author.viewer
            ? {
                blockedBy: post.author.viewer?.blockedBy,
                blocking: post.author.viewer?.blocking,
              }
            : undefined,
        },
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
    did: string,
    embed: EmbedRecordWithMedia,
    embedRecordView: RecordEmbedViewRecord,
  ) {
    let mediaEmbed: EmbedImagesView | EmbedExternalView
    if (isEmbedImages(embed.media)) {
      mediaEmbed = this.imagesEmbedView(did, embed.media)
    } else if (isEmbedExternal(embed.media)) {
      mediaEmbed = this.externalEmbedView(did, embed.media)
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
