import { mapDefined } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
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
import { Record as PostRecord } from '../../lexicon/types/app/bsky/feed/post'
import { isListRule } from '../../lexicon/types/app/bsky/feed/threadgate'
import {
  PostEmbedViews,
  FeedGenInfo,
  FeedRow,
  MaybePostView,
  PostInfoMap,
  RecordEmbedViewRecord,
  PostBlocksMap,
  FeedHydrationState,
  ThreadgateInfoMap,
  ThreadgateInfo,
} from './types'
import { Labels, getSelfLabels } from '../label'
import { ImageUriBuilder } from '../../image/uri'
import { ActorInfoMap, ActorService } from '../actor'
import { ListInfoMap, GraphService } from '../graph'
import { FromDb } from '../types'
import { parseThreadGate } from './util'

export class FeedViews {
  services: {
    actor: ActorService
    graph: GraphService
  }

  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    private actor: FromDb<ActorService>,
    private graph: FromDb<GraphService>,
  ) {
    this.services = {
      actor: actor(this.db),
      graph: graph(this.db),
    }
  }

  static creator(
    imgUriBuilder: ImageUriBuilder,
    actor: FromDb<ActorService>,
    graph: FromDb<GraphService>,
  ) {
    return (db: Database) => new FeedViews(db, imgUriBuilder, actor, graph)
  }

  formatFeedGeneratorView(
    info: FeedGenInfo,
    profiles: ActorInfoMap,
  ): GeneratorView | undefined {
    const profile = profiles[info.creator]
    if (!profile) {
      return undefined
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
    viewer: string | null,
    opts?: {
      usePostViewUnion?: boolean
    },
  ): FeedViewPost[] {
    const { posts, threadgates, profiles, blocks, embeds, labels, lists } =
      state
    const actors = this.services.actor.views.profileBasicPresentation(
      Object.keys(profiles),
      state,
      viewer,
    )
    const feed: FeedViewPost[] = []
    for (const item of items) {
      const info = posts[item.postUri]
      const post = this.formatPostView(
        item.postUri,
        actors,
        posts,
        threadgates,
        embeds,
        labels,
        lists,
        viewer,
      )
      // skip over not found post
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
            by: originator,
            indexedAt: item.sortAt,
          }
        }
      }
      // posts that violate reply-gating may appear in feeds, but without any thread context
      if (
        item.replyParent &&
        item.replyRoot &&
        !info?.invalidReplyRoot &&
        !info?.violatesThreadGate
      ) {
        const replyParent = this.formatMaybePostView(
          item.replyParent,
          item.uri,
          actors,
          posts,
          threadgates,
          embeds,
          labels,
          lists,
          blocks,
          viewer,
          opts,
        )
        const replyRoot = this.formatMaybePostView(
          item.replyRoot,
          item.uri,
          actors,
          posts,
          threadgates,
          embeds,
          labels,
          lists,
          blocks,
          viewer,
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
    threadgates: ThreadgateInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    lists: ListInfoMap,
    viewer: string | null,
  ): PostView | undefined {
    const post = posts[uri]
    const gate = threadgates[uri]
    const author = actors[post?.creator]
    if (!post || !author) {
      return undefined
    }
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
            replyDisabled: this.userReplyDisabled(
              uri,
              actors,
              posts,
              threadgates,
              lists,
              viewer,
            ),
          }
        : undefined,
      labels: [...postLabels, ...postSelfLabels],
      threadgate:
        !post.record.reply && gate
          ? this.formatThreadgate(gate, lists)
          : undefined,
    }
  }

  userReplyDisabled(
    uri: string,
    actors: ActorInfoMap,
    posts: PostInfoMap,
    threadgates: ThreadgateInfoMap,
    lists: ListInfoMap,
    viewer: string | null,
  ): boolean | undefined {
    if (viewer === null) {
      return undefined
    } else if (posts[uri]?.violatesThreadGate) {
      return true
    }

    const rootUriStr: string =
      posts[uri]?.record?.['reply']?.['root']?.['uri'] ?? uri
    const gate = threadgates[rootUriStr]?.record
    if (!gate) {
      return undefined
    }
    const rootPost = posts[rootUriStr]?.record as PostRecord | undefined
    const ownerDid = new AtUri(rootUriStr).hostname

    const {
      canReply,
      allowFollowing,
      allowListUris = [],
    } = parseThreadGate(viewer, ownerDid, rootPost ?? null, gate ?? null)

    if (canReply) {
      return false
    }
    if (allowFollowing && actors[ownerDid]?.viewer?.followedBy) {
      return false
    }
    for (const listUri of allowListUris) {
      const list = lists[listUri]
      if (list?.viewerInList) {
        return false
      }
    }
    return true
  }

  formatMaybePostView(
    uri: string,
    replyUri: string | null,
    actors: ActorInfoMap,
    posts: PostInfoMap,
    threadgates: ThreadgateInfoMap,
    embeds: PostEmbedViews,
    labels: Labels,
    lists: ListInfoMap,
    blocks: PostBlocksMap,
    viewer: string | null,
    opts?: {
      usePostViewUnion?: boolean
    },
  ): MaybePostView | undefined {
    const post = this.formatPostView(
      uri,
      actors,
      posts,
      threadgates,
      embeds,
      labels,
      lists,
      viewer,
    )
    if (!post) {
      if (!opts?.usePostViewUnion) return
      return this.notFoundPost(uri)
    }
    if (
      post.author.viewer?.blockedBy ||
      post.author.viewer?.blocking ||
      (replyUri !== null && blocks[replyUri]?.reply)
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

  formatThreadgate(gate: ThreadgateInfo, lists: ListInfoMap) {
    return {
      uri: gate.uri,
      cid: gate.cid,
      record: gate.record,
      lists: mapDefined(gate.record.allow ?? [], (rule) => {
        if (!isListRule(rule)) return
        const list = lists[rule.list]
        if (!list) return
        return this.services.graph.formatListViewBasic(list)
      }),
    }
  }
}
