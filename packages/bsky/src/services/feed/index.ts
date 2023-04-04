import { sql } from 'kysely'
import { AtUri } from '@atproto/uri'
import { jsonStringToLex } from '@atproto/lexicon'
import Database from '../../db'
import { countAll, notSoftDeletedClause } from '../../db/util'
import { ImageUriBuilder } from '../../image/uri'
import { isView as isViewImages } from '../../lexicon/types/app/bsky/embed/images'
import { isView as isViewExternal } from '../../lexicon/types/app/bsky/embed/external'
import { View as ViewRecord } from '../../lexicon/types/app/bsky/embed/record'
import { PostView } from '../../lexicon/types/app/bsky/feed/defs'
import { ActorViewMap, FeedEmbeds, PostInfoMap, FeedItemType } from '../types'

export class FeedService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

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
        'post.uri as postUri',
        'post.cid as postCid',
        'post.creator as originatorDid',
        'post.creator as authorDid',
        'post.replyParent as replyParent',
        'post.replyRoot as replyRoot',
        'post.indexedAt as cursor',
      ])
  }

  selectRepostQb() {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('repost')
      .innerJoin('post', 'post.uri', 'repost.subject')
      .innerJoin('actor as author', 'author.did', 'post.creator')
      .innerJoin('actor as originator', 'originator.did', 'repost.creator')
      .innerJoin('record as post_record', 'post_record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('author')))
      .where(notSoftDeletedClause(ref('originator')))
      .where(notSoftDeletedClause(ref('post_record')))
      .select([
        sql<FeedItemType>`${'repost'}`.as('type'),
        'post.uri as postUri',
        'post.cid as postCid',
        'repost.creator as originatorDid',
        'post.creator as authorDid',
        'post.replyParent as replyParent',
        'post.replyRoot as replyRoot',
        'repost.indexedAt as cursor',
      ])
  }

  // @NOTE keep in sync with actorService.views.profile()
  async getActorViews(
    dids: string[],
    requester: string,
  ): Promise<ActorViewMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const actors = await this.db.db
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
          .where('creator', '=', requester)
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', requester)
          .select('uri')
          .as('requesterFollowedBy'),
      ])
      .execute()
    return actors.reduce((acc, cur) => {
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
          viewer: {
            following: cur?.requesterFollowing || undefined,
            followedBy: cur?.requesterFollowedBy || undefined,
            // muted field hydrated on pds
          },
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
      .innerJoin('actor', 'actor.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('actor'))) // Ensures post reply parent/roots get omitted from views when taken down
      .where(notSoftDeletedClause(ref('record')))
      .select([
        'post.uri as uri',
        'post.cid as cid',
        'post.creator as creator',
        'post.indexedAt as indexedAt',
        'record.json as recordJson',
        db
          .selectFrom('like')
          .whereRef('subject', '=', ref('post.uri'))
          .select(countAll.as('count'))
          .as('likeCount'),
        db
          .selectFrom('repost')
          .whereRef('subject', '=', ref('post.uri'))
          .select(countAll.as('count'))
          .as('repostCount'),
        db
          .selectFrom('post as reply')
          .whereRef('reply.replyParent', '=', ref('post.uri'))
          .select(countAll.as('count'))
          .as('replyCount'),
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
    const [postViews, actorViews, deepEmbedViews] = await Promise.all([
      this.getPostViews(
        records.map((p) => p.uri),
        requester,
      ),
      this.getActorViews(
        records.map((p) => p.did),
        requester,
      ),
      this.embedsForPosts(
        records.map((p) => p.uri),
        requester,
        _depth + 1,
      ),
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
      const formatted = this.formatPostView(
        cur.uri,
        actorViews,
        postViews,
        deepEmbedViews,
      )
      let deepEmbeds: ViewRecord['embeds'] | undefined
      if (_depth < 1) {
        // Omit field entirely when too deep: e.g. don't include it on the embeds within a record embed.
        // Otherwise list any embeds that appear within the record. A consumer may discover an embed
        // within the raw record, then look within this array to find the presented view of it.
        deepEmbeds = formatted?.embed ? [formatted.embed] : []
      }
      const recordEmbed = {
        record: formatted
          ? {
              $type: 'app.bsky.embed.record#viewRecord',
              uri: formatted.uri,
              cid: formatted.cid,
              author: formatted.author,
              value: formatted.record,
              embeds: deepEmbeds,
              indexedAt: formatted.indexedAt,
            }
          : {
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

  formatPostView(
    uri: string,
    actors: ActorViewMap,
    posts: PostInfoMap,
    embeds: FeedEmbeds,
  ): PostView | undefined {
    const post = posts[uri]
    const author = actors[post?.creator]
    if (!post || !author) return undefined
    return {
      uri: post.uri,
      cid: post.cid,
      author: author,
      record: jsonStringToLex(post.recordJson) as Record<string, unknown>,
      embed: embeds[uri],
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      likeCount: post.likeCount,
      indexedAt: post.indexedAt,
      viewer: {
        repost: post.requesterRepost ?? undefined,
        like: post.requesterLike ?? undefined,
      },
    }
  }
}
