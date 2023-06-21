import { sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { dedupeStrs } from '@atproto/common'
import Database from '../../../db'
import { countAll, notSoftDeletedClause } from '../../../db/util'
import { ImageUriBuilder } from '../../../image/uri'
import { ids } from '../../../lexicon/lexicons'
import { isView as isViewImages } from '../../../lexicon/types/app/bsky/embed/images'
import { isView as isViewExternal } from '../../../lexicon/types/app/bsky/embed/external'
import {
  ViewBlocked,
  ViewNotFound,
  ViewRecord,
  View as RecordEmbedView,
} from '../../../lexicon/types/app/bsky/embed/record'
import {
  FeedViewPost,
  PostView,
} from '../../../lexicon/types/app/bsky/feed/defs'
import {
  ActorViewMap,
  FeedEmbeds,
  PostInfoMap,
  FeedItemType,
  FeedRow,
  FeedGenInfoMap,
} from './types'
import { LabelService } from '../label'
import { FeedViews } from './views'
import { ActorService } from '../actor'

export * from './types'

export class FeedService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedService(db, imgUriBuilder)
  }

  views = new FeedViews(this.db, this.imgUriBuilder)
  services = {
    label: LabelService.creator()(this.db),
    actor: ActorService.creator(this.imgUriBuilder)(this.db),
  }

  selectPostQb() {
    return this.db.db
      .selectFrom('post')
      .select([
        sql<FeedItemType>`${'post'}`.as('type'),
        'post.uri as uri',
        'post.cid as cid',
        'post.uri as postUri',
        'post.creator as originatorDid',
        'post.creator as postAuthorDid',
        'post.replyParent as replyParent',
        'post.replyRoot as replyRoot',
        'post.indexedAt as sortAt',
      ])
  }

  selectFeedItemQb() {
    return this.db.db
      .selectFrom('feed_item')
      .innerJoin('post', 'post.uri', 'feed_item.postUri')
      .selectAll('feed_item')
      .select([
        'post.replyRoot',
        'post.replyParent',
        'post.creator as postAuthorDid',
      ])
  }

  selectFeedGeneratorQb(requester: string) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('feed_generator')
      .innerJoin('did_handle', 'did_handle.did', 'feed_generator.creator')
      .innerJoin(
        'repo_root as creator_repo',
        'creator_repo.did',
        'feed_generator.creator',
      )
      .innerJoin('record', 'record.uri', 'feed_generator.uri')
      .selectAll()
      .where(notSoftDeletedClause(ref('creator_repo')))
      .where(notSoftDeletedClause(ref('record')))
      .select((qb) =>
        qb
          .selectFrom('like')
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select(countAll.as('count'))
          .as('likeCount'),
      )
      .select((qb) =>
        qb
          .selectFrom('like')
          .where('like.creator', '=', requester)
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select('uri')
          .as('viewerLike'),
      )
  }

  // @NOTE keep in sync with actorService.views.profile()
  async getActorViews(
    dids: string[],
    requester: string,
    opts?: { skipLabels?: boolean; includeSoftDeleted?: boolean }, // @NOTE used by hydrateFeed() to batch label hydration
  ): Promise<ActorViewMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const { skipLabels = false, includeSoftDeleted = false } = opts ?? {}
    const [actors, labels, listMutes] = await Promise.all([
      this.db.db
        .selectFrom('did_handle')
        .where('did_handle.did', 'in', dids)
        .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .selectAll('did_handle')
        .if(!includeSoftDeleted, (qb) =>
          qb.where(notSoftDeletedClause(ref('repo_root'))),
        )
        .select([
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          'profile.avatarCid as avatarCid',
          'profile.indexedAt as indexedAt',
          this.db.db
            .selectFrom('follow')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterFollowing'),
          this.db.db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester)
            .select('uri')
            .as('requesterFollowedBy'),
          this.db.db
            .selectFrom('actor_block')
            .where('creator', '=', requester)
            .whereRef('subjectDid', '=', ref('did_handle.did'))
            .select('uri')
            .as('requesterBlocking'),
          this.db.db
            .selectFrom('actor_block')
            .whereRef('creator', '=', ref('did_handle.did'))
            .where('subjectDid', '=', requester)
            .select('uri')
            .as('requesterBlockedBy'),
          this.db.db
            .selectFrom('mute')
            .whereRef('did', '=', ref('did_handle.did'))
            .where('mutedByDid', '=', requester)
            .select('did')
            .as('requesterMuted'),
        ])
        .execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
      this.services.actor.views.getListMutes(dids, requester),
    ])
    return actors.reduce((acc, cur) => {
      const actorLabels = labels[cur.did] ?? []
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          handle: cur.handle,
          displayName: truncateUtf8(cur.displayName, 64) || undefined,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
            : undefined,
          viewer: {
            muted: !!cur?.requesterMuted || !!listMutes[cur.did],
            mutedByList: listMutes[cur.did],
            blockedBy: !!cur?.requesterBlockedBy,
            blocking: cur?.requesterBlocking || undefined,
            following: cur?.requesterFollowing || undefined,
            followedBy: cur?.requesterFollowedBy || undefined,
          },
          labels: skipLabels ? undefined : actorLabels,
        },
      }
    }, {} as ActorViewMap)
  }

  async getPostViews(
    postUris: string[],
    requester: string,
  ): Promise<PostInfoMap> {
    if (postUris.length < 1) return {}
    const db = this.db.db
    const { ref } = db.dynamic
    const posts = await db
      .selectFrom('post')
      .where('post.uri', 'in', postUris)
      .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'post.cid')
          .onRef('ipld_block.creator', '=', 'post.creator'),
      )
      .innerJoin('repo_root', 'repo_root.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('repo_root'))) // Ensures post reply parent/roots get omitted from views when taken down
      .where(notSoftDeletedClause(ref('record')))
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.indexedAt as indexedAt',
        'ipld_block.content as recordBytes',
        'post_agg.likeCount as likeCount',
        'post_agg.repostCount as repostCount',
        'post_agg.replyCount as replyCount',
        db
          .selectFrom('repost')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterRepost'),
        db
          .selectFrom('like')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterLike'),
      ])
      .execute()
    return posts.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: cur,
      }),
      {} as PostInfoMap,
    )
  }

  async getFeedGeneratorViews(generatorUris: string[], requester: string) {
    if (generatorUris.length < 1) return {}
    const feedGens = await this.selectFeedGeneratorQb(requester)
      .where('feed_generator.uri', 'in', generatorUris)
      .execute()
    return feedGens.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: cur,
      }),
      {} as FeedGenInfoMap,
    )
  }

  async embedsForPosts(
    uris: string[],
    requester: string,
    _depth = 0,
  ): Promise<FeedEmbeds> {
    if (uris.length < 1 || _depth > 1) {
      // If a post has a record embed which contains additional embeds, the depth check
      // above ensures that we don't recurse indefinitely into those additional embeds.
      // In short, you receive up to two layers of embeds for the post: this allows us to
      // handle the case that a post has a record embed, which in turn has images embedded in it.
      return {}
    }
    const imgPromise = this.db.db
      .selectFrom('post_embed_image')
      .selectAll()
      .where('postUri', 'in', uris)
      .orderBy('postUri')
      .orderBy('position')
      .execute()
    const extPromise = this.db.db
      .selectFrom('post_embed_external')
      .selectAll()
      .where('postUri', 'in', uris)
      .execute()
    const recordPromise = this.db.db
      .selectFrom('post_embed_record')
      .innerJoin('record as embed', 'embed.uri', 'embedUri')
      .where('postUri', 'in', uris)
      .select(['postUri', 'embed.uri as uri', 'embed.did as did'])
      .execute()
    const [images, externals, records] = await Promise.all([
      imgPromise,
      extPromise,
      recordPromise,
    ])
    const nestedUris = dedupeStrs(records.map((p) => p.uri))
    const nestedDids = dedupeStrs(records.map((p) => p.did))
    const nestedPostUris = nestedUris.filter(
      (uri) => new AtUri(uri).collection === ids.AppBskyFeedPost,
    )
    const nestedFeedGenUris = nestedUris.filter(
      (uri) => new AtUri(uri).collection === ids.AppBskyFeedGenerator,
    )
    const [postViews, actorViews, deepEmbedViews, labelViews, feedGenViews] =
      await Promise.all([
        this.getPostViews(nestedPostUris, requester),
        this.getActorViews(nestedDids, requester, { skipLabels: true }),
        this.embedsForPosts(nestedPostUris, requester, _depth + 1),
        this.services.label.getLabelsForSubjects([
          ...nestedPostUris,
          ...nestedDids,
        ]),
        this.getFeedGeneratorViews(nestedFeedGenUris, requester),
      ])
    let embeds = images.reduce((acc, cur) => {
      const embed = (acc[cur.postUri] ??= {
        $type: 'app.bsky.embed.images#view',
        images: [],
      })
      if (!isViewImages(embed)) return acc
      embed.images.push({
        thumb: this.imgUriBuilder.getCommonSignedUri(
          'feed_thumbnail',
          cur.imageCid,
        ),
        fullsize: this.imgUriBuilder.getCommonSignedUri(
          'feed_fullsize',
          cur.imageCid,
        ),
        alt: cur.alt,
      })
      return acc
    }, {} as FeedEmbeds)
    embeds = externals.reduce((acc, cur) => {
      if (!acc[cur.postUri]) {
        acc[cur.postUri] = {
          $type: 'app.bsky.embed.external#view',
          external: {
            uri: cur.uri,
            title: cur.title,
            description: cur.description,
            thumb: cur.thumbCid
              ? this.imgUriBuilder.getCommonSignedUri(
                  'feed_thumbnail',
                  cur.thumbCid,
                )
              : undefined,
          },
        }
      }
      return acc
    }, embeds)
    embeds = records.reduce((acc, cur) => {
      const collection = new AtUri(cur.uri).collection
      let recordEmbed: RecordEmbedView
      if (collection === ids.AppBskyFeedGenerator && feedGenViews[cur.uri]) {
        recordEmbed = {
          record: {
            $type: 'app.bsky.feed.defs#generatorView',
            ...this.views.formatFeedGeneratorView(
              feedGenViews[cur.uri],
              actorViews,
              labelViews,
            ),
          },
        }
      } else if (collection === ids.AppBskyFeedPost && postViews[cur.uri]) {
        const formatted = this.views.formatPostView(
          cur.uri,
          actorViews,
          postViews,
          deepEmbedViews,
          labelViews,
        )
        let deepEmbeds: ViewRecord['embeds'] | undefined
        if (_depth < 1) {
          // Omit field entirely when too deep: e.g. don't include it on the embeds within a record embed.
          // Otherwise list any embeds that appear within the record. A consumer may discover an embed
          // within the raw record, then look within this array to find the presented view of it.
          deepEmbeds = formatted?.embed ? [formatted.embed] : []
        }
        recordEmbed = {
          record: getRecordEmbedView(cur.uri, formatted, deepEmbeds),
        }
      } else {
        recordEmbed = {
          record: {
            $type: 'app.bsky.embed.record#viewNotFound',
            uri: cur.uri,
          },
        }
      }
      if (acc[cur.postUri]) {
        const mediaEmbed = acc[cur.postUri]
        if (isViewImages(mediaEmbed) || isViewExternal(mediaEmbed)) {
          acc[cur.postUri] = {
            $type: 'app.bsky.embed.recordWithMedia#view',
            record: recordEmbed,
            media: mediaEmbed,
          }
        }
      } else {
        acc[cur.postUri] = {
          $type: 'app.bsky.embed.record#view',
          ...recordEmbed,
        }
      }
      return acc
    }, embeds)
    return embeds
  }

  async hydrateFeed(
    items: FeedRow[],
    requester: string,
    // @TODO (deprecated) remove this once all clients support the blocked/not-found union on post views
    usePostViewUnion?: boolean,
  ): Promise<FeedViewPost[]> {
    const actorDids = new Set<string>()
    const postUris = new Set<string>()
    for (const item of items) {
      actorDids.add(item.postAuthorDid)
      postUris.add(item.postUri)
      if (item.postAuthorDid !== item.originatorDid) {
        actorDids.add(item.originatorDid)
      }
      if (item.replyParent) {
        postUris.add(item.replyParent)
        actorDids.add(new AtUri(item.replyParent).hostname)
      }
      if (item.replyRoot) {
        postUris.add(item.replyRoot)
        actorDids.add(new AtUri(item.replyRoot).hostname)
      }
    }
    const [actors, posts, embeds, labels] = await Promise.all([
      this.getActorViews(Array.from(actorDids), requester, {
        skipLabels: true,
      }),
      this.getPostViews(Array.from(postUris), requester),
      this.embedsForPosts(Array.from(postUris), requester),
      this.services.label.getLabelsForSubjects([...postUris, ...actorDids]),
    ])

    return this.views.formatFeed(
      items,
      actors,
      posts,
      embeds,
      labels,
      usePostViewUnion,
    )
  }
}

function truncateUtf8(str: string | null | undefined, length: number) {
  if (!str) return str
  const encoder = new TextEncoder()
  const utf8 = encoder.encode(str)
  if (utf8.length > length) {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const truncated = utf8.slice(0, length)
    return decoder.decode(truncated).replace(/\uFFFD$/, '')
  }
  return str
}

function getRecordEmbedView(
  uri: string,
  post?: PostView,
  embeds?: ViewRecord['embeds'],
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
    embeds,
  }
}
