import { sql } from 'kysely'
import * as common from '@atproto/common'
import Database from '../../../db'
import { countAll, notSoftDeletedClause } from '../../../db/util'
import { ImageUriBuilder } from '../../../image/uri'
import { isPresented as isPresentedImage } from '../../../lexicon/types/app/bsky/embed/images'
import { View as PostView } from '../../../lexicon/types/app/bsky/feed/post'
import { ActorViewMap, FeedEmbeds, PostInfoMap, FeedItemType } from './types'
import { getDeclarationSimple } from '../../../api/app/bsky/util'

export * from './types'

export class FeedService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new FeedService(db, imgUriBuilder)
  }

  selectPostQb() {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('post')
      .innerJoin('repo_root as author_repo', 'author_repo.did', 'post.creator')
      .innerJoin('record', 'record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('author_repo')))
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
      .innerJoin('repo_root as author_repo', 'author_repo.did', 'post.creator')
      .innerJoin(
        'repo_root as originator_repo',
        'originator_repo.did',
        'repost.creator',
      )
      .innerJoin('record as post_record', 'post_record.uri', 'post.uri')
      .where(notSoftDeletedClause(ref('author_repo')))
      .where(notSoftDeletedClause(ref('originator_repo')))
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

  // @NOTE keep in sync with actorService.views.actorWithInfo()
  async getActorViews(
    dids: string[],
    requester: string,
  ): Promise<ActorViewMap> {
    if (dids.length < 1) return {}
    const { ref } = this.db.db.dynamic
    const actors = await this.db.db
      .selectFrom('did_handle')
      .where('did_handle.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .selectAll('did_handle')
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
          .selectFrom('mute')
          .whereRef('did', '=', ref('did_handle.did'))
          .where('mutedByDid', '=', requester)
          .select('did')
          .as('requesterMuted'),
      ])
      .execute()
    return actors.reduce((acc, cur) => {
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          declaration: getDeclarationSimple(cur),
          handle: cur.handle,
          displayName: cur.displayName || undefined,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
            : undefined,
          viewer: {
            muted: !!cur?.requesterMuted,
            following: cur?.requesterFollowing || undefined,
            followedBy: cur?.requesterFollowedBy || undefined,
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
        db
          .selectFrom('vote')
          .whereRef('subject', '=', ref('post.uri'))
          .where('direction', '=', 'up')
          .select(countAll.as('count'))
          .as('upvoteCount'),
        db
          .selectFrom('vote')
          .whereRef('subject', '=', ref('post.uri'))
          .where('direction', '=', 'down')
          .select(countAll.as('count'))
          .as('downvoteCount'),
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
          .selectFrom('vote')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .where('direction', '=', 'up')
          .select('uri')
          .as('requesterUpvote'),
        db
          .selectFrom('vote')
          .where('creator', '=', requester)
          .whereRef('subject', '=', ref('post.uri'))
          .where('direction', '=', 'down')
          .select('uri')
          .as('requesterDownvote'),
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

  async embedsForPosts(uris: string[], requester: string): Promise<FeedEmbeds> {
    if (uris.length < 1) {
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
    const [postViews, actorViews] = await Promise.all([
      this.getPostViews(
        records.map((p) => p.uri),
        requester,
      ),
      this.getActorViews(
        records.map((p) => p.did),
        requester,
      ),
    ])
    let embeds = images.reduce((acc, cur) => {
      const embed = (acc[cur.postUri] ??= {
        $type: 'app.bsky.embed.images#presented',
        images: [],
      })
      if (!isPresentedImage(embed)) return acc
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
          $type: 'app.bsky.embed.external#presented',
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
      if (!acc[cur.postUri]) {
        const formatted = this.formatPostView(
          cur.uri,
          actorViews,
          postViews,
          {},
        )
        acc[cur.postUri] = {
          $type: 'app.bsky.embed.record#presented',
          record: formatted
            ? {
                $type: 'app.bsky.embed.record#presentedRecord',
                uri: formatted.uri,
                cid: formatted.cid,
                author: formatted.author,
                record: formatted.record,
              }
            : {
                $type: 'app.bsky.embed.record#presentedNotFound',
                uri: cur.uri,
              },
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
      record: common.cborDecode(post.recordBytes),
      embed: embeds[uri],
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      upvoteCount: post.upvoteCount,
      downvoteCount: post.downvoteCount,
      indexedAt: post.indexedAt,
      viewer: {
        repost: post.requesterRepost ?? undefined,
        upvote: post.requesterUpvote ?? undefined,
        downvote: post.requesterDownvote ?? undefined,
      },
    }
  }
}
