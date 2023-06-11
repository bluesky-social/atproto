import { sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { dedupeStrs } from '@atproto/common'
import Database from '../../db'
import { countAll, noMatch, notSoftDeletedClause } from '../../db/util'
import { ImageUriBuilder } from '../../image/uri'
import { ids } from '../../lexicon/lexicons'
import { isView as isViewImages } from '../../lexicon/types/app/bsky/embed/images'
import { isView as isViewExternal } from '../../lexicon/types/app/bsky/embed/external'
import {
  ViewRecord,
  View as RecordEmbedView,
} from '../../lexicon/types/app/bsky/embed/record'
import {
  ActorViewMap,
  FeedEmbeds,
  PostInfoMap,
  FeedItemType,
  FeedRow,
} from '../types'
import { LabelService } from '../label'
import { ActorService } from '../actor'
import { FeedViews } from './views'
import { FeedGenInfoMap } from './types'
import { FeedViewPost } from '../../lexicon/types/app/bsky/feed/defs'

export class FeedService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  views = new FeedViews(this.db, this.imgUriBuilder)

  services = {
    label: LabelService.creator()(this.db),
    actor: ActorService.creator(this.imgUriBuilder)(this.db),
  }

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedService(db, imgUriBuilder)
  }

  selectPostQb() {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('post')
      .innerJoin('actor as author', 'author.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('author')))
      .where(notSoftDeletedClause(ref('record')))
      .select([
        sql<FeedItemType>`${'post'}`.as('type'),
        'post.uri as uri',
        'post.cid as cid',
        'post.uri as postUri',
        'post.creator as originatorDid',
        'post.creator as postAuthorDid',
        'post.replyParent as replyParent',
        'post.replyRoot as replyRoot',
        'post.sortAt as sortAt',
      ])
  }

  selectFeedItemQb() {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('feed_item')
      .innerJoin('post', 'post.uri', 'feed_item.postUri')
      .innerJoin('actor as author', 'author.did', 'post.creator')
      .innerJoin(
        'actor as originator',
        'originator.did',
        'feed_item.originatorDid',
      )
      .innerJoin('record as post_record', 'post_record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('author')))
      .where(notSoftDeletedClause(ref('originator')))
      .where(notSoftDeletedClause(ref('post_record')))
      .selectAll('feed_item')
      .select([
        'post.replyRoot',
        'post.replyParent',
        'post.creator as postAuthorDid',
      ])
  }

  selectFeedGeneratorQb(viewer?: string | null) {
    return this.db.db
      .selectFrom('feed_generator')
      .innerJoin('actor', 'actor.did', 'feed_generator.creator')
      .selectAll('feed_generator')
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
          .if(!viewer, (q) => q.where(noMatch))
          .where('like.creator', '=', viewer ?? '')
          .whereRef('like.subject', '=', 'feed_generator.uri')
          .select('uri')
          .as('viewerLike'),
      )
  }

  // @TODO just use actor service??
  // @NOTE keep in sync with actorService.views.profile()
  async getActorViews(
    dids: string[],
    viewer: string | null,
    opts?: { skipLabels?: boolean }, // @NOTE used by hydrateFeed() to batch label hydration
  ): Promise<ActorViewMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const { skipLabels } = opts ?? {}
    const [actors, labels, listMutes] = await Promise.all([
      this.db.db
        .selectFrom('actor')
        .where('actor.did', 'in', dids)
        .leftJoin('profile', 'profile.creator', 'actor.did')
        .selectAll('actor')
        .select([
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          'profile.avatarCid as avatarCid',
          'profile.indexedAt as indexedAt',
          this.db.db
            .selectFrom('follow')
            .if(!viewer, (q) => q.where(noMatch))
            .where('creator', '=', viewer ?? '')
            .whereRef('subjectDid', '=', ref('actor.did'))
            .select('uri')
            .as('requesterFollowing'),
          this.db.db
            .selectFrom('follow')
            .if(!viewer, (q) => q.where(noMatch))
            .whereRef('creator', '=', ref('actor.did'))
            .where('subjectDid', '=', viewer ?? '')
            .select('uri')
            .as('requesterFollowedBy'),
          this.db.db
            .selectFrom('mute')
            .if(!viewer, (q) => q.where(noMatch))
            .whereRef('subjectDid', '=', ref('actor.did'))
            .where('mutedByDid', '=', viewer ?? '')
            .select('subjectDid')
            .as('requesterMuted'),
        ])
        .execute(),
      this.services.label.getLabelsForSubjects(skipLabels ? [] : dids),
      this.services.actor.views.getListMutes(dids, viewer),
    ])
    return actors.reduce((acc, cur) => {
      const actorLabels = labels[cur.did] ?? []
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          handle: cur.handle,
          displayName: cur.displayName || undefined,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri(
                'avatar',
                cur.did,
                cur.avatarCid,
              )
            : undefined,
          viewer: viewer
            ? {
                muted: !!cur?.requesterMuted || !!listMutes[cur.did],
                mutedByList: listMutes[cur.did],
                following: cur?.requesterFollowing || undefined,
                followedBy: cur?.requesterFollowedBy || undefined,
              }
            : undefined,
          labels: skipLabels ? undefined : actorLabels,
        },
      }
    }, {} as ActorViewMap)
  }

  async getPostViews(
    postUris: string[],
    viewer: string | null,
  ): Promise<PostInfoMap> {
    if (postUris.length < 1) return {}
    const db = this.db.db
    const { ref } = db.dynamic
    const posts = await db
      .selectFrom('post')
      .where('post.uri', 'in', postUris)
      .innerJoin('actor', 'actor.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('actor'))) // Ensures post reply parent/roots get omitted from views when taken down
      .where(notSoftDeletedClause(ref('record')))
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.indexedAt as indexedAt',
        'record.json as recordJson',
        'post_agg.likeCount as likeCount',
        'post_agg.repostCount as repostCount',
        'post_agg.replyCount as replyCount',
        db
          .selectFrom('repost')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterRepost'),
        db
          .selectFrom('like')
          .if(!viewer, (q) => q.where(noMatch))
          .where('creator', '=', viewer ?? '')
          .whereRef('subject', '=', ref('post.uri'))
          .select('uri')
          .as('requesterLike'),
      ])
      .execute()
    return posts.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: Object.assign(cur, { viewer }),
      }),
      {} as PostInfoMap,
    )
  }

  async getFeedGeneratorViews(generatorUris: string[], viewer: string | null) {
    if (generatorUris.length < 1) return {}
    const feedGens = await this.selectFeedGeneratorQb(viewer)
      .where('uri', 'in', generatorUris)
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
    viewer: string | null,
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
        this.getPostViews(nestedPostUris, viewer),
        this.getActorViews(nestedDids, viewer, { skipLabels: true }),
        this.embedsForPosts(nestedUris, viewer, _depth + 1),
        this.services.label.getLabelsForSubjects([
          ...nestedUris,
          ...nestedDids,
        ]),
        this.getFeedGeneratorViews(nestedFeedGenUris, viewer),
      ])
    let embeds = images.reduce((acc, cur) => {
      const embed = (acc[cur.postUri] ??= {
        $type: 'app.bsky.embed.images#view',
        images: [],
      })
      if (!isViewImages(embed)) return acc
      const postUri = new AtUri(cur.postUri)
      embed.images.push({
        thumb: this.imgUriBuilder.getCommonSignedUri(
          'feed_thumbnail',
          postUri.host,
          cur.imageCid,
        ),
        fullsize: this.imgUriBuilder.getCommonSignedUri(
          'feed_fullsize',
          postUri.host,
          cur.imageCid,
        ),
        alt: cur.alt,
      })
      return acc
    }, {} as FeedEmbeds)
    embeds = externals.reduce((acc, cur) => {
      if (!acc[cur.postUri]) {
        const postUri = new AtUri(cur.postUri)
        acc[cur.postUri] = {
          $type: 'app.bsky.embed.external#view',
          external: {
            uri: cur.uri,
            title: cur.title,
            description: cur.description,
            thumb: cur.thumbCid
              ? this.imgUriBuilder.getCommonSignedUri(
                  'feed_thumbnail',
                  postUri.host,
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
        if (formatted) {
          recordEmbed = {
            record: {
              $type: 'app.bsky.embed.record#viewRecord',
              uri: formatted.uri,
              cid: formatted.cid,
              author: formatted.author,
              value: formatted.record,
              labels: formatted.labels,
              embeds: deepEmbeds,
              indexedAt: formatted.indexedAt,
            },
          }
        }
      }
      recordEmbed ??= {
        record: {
          $type: 'app.bsky.embed.record#viewNotFound',
          uri: cur.uri,
        },
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
    viewer: string | null,
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
      this.getActorViews(Array.from(actorDids), viewer, {
        skipLabels: true,
      }),
      this.getPostViews(Array.from(postUris), viewer),
      this.embedsForPosts(Array.from(postUris), viewer),
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
