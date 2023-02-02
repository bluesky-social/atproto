import { sql } from 'kysely'
import * as common from '@atproto/common'
import Database from '../../db'
import { countAll, notSoftDeletedClause } from '../../db/util'
import { ImageUriBuilder } from '../../image/uri'
import { Presented as PresentedImage } from '../../lexicon/types/app/bsky/embed/images'
import { View as PostView } from '../../lexicon/types/app/bsky/feed/post'
import { ActorViewMap, FeedEmbeds, PostInfoMap, FeedItemType } from './types'

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

  async getActorViews(
    dids: string[],
    requester: string,
  ): Promise<ActorViewMap> {
    if (dids.length < 1) return {}
    const actors = await this.db.db
      .selectFrom('did_handle as actor')
      .where('actor.did', 'in', dids)
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .leftJoin('mute', (join) =>
        join
          .onRef('mute.did', '=', 'actor.did')
          .on('mute.mutedByDid', '=', requester),
      )
      .select([
        'actor.did as did',
        'actor.declarationCid as declarationCid',
        'actor.actorType as actorType',
        'actor.handle as handle',
        'profile.displayName as displayName',
        'profile.avatarCid as avatarCid',
        'mute.did as muted',
      ])
      .execute()
    return actors.reduce((acc, cur) => {
      return {
        ...acc,
        [cur.did]: {
          did: cur.did,
          declaration: {
            cid: cur.declarationCid,
            actorType: cur.actorType,
          },
          handle: cur.handle,
          displayName: cur.displayName ?? undefined,
          avatar: cur.avatarCid
            ? this.imgUriBuilder.getCommonSignedUri('avatar', cur.avatarCid)
            : undefined,
          viewer: { muted: !!cur.muted },
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
      .innerJoin('ipld_block', 'ipld_block.cid', 'post.cid')
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

  async embedsForPosts(uris: string[]): Promise<FeedEmbeds> {
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
    const [images, externals] = await Promise.all([imgPromise, extPromise])
    const imgEmbeds = images.reduce((acc, cur) => {
      if (!acc[cur.postUri]) {
        acc[cur.postUri] = {
          $type: 'app.bsky.embed.images#presented',
          images: [],
        }
      }
      acc[cur.postUri].images.push({
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
    }, {} as { [uri: string]: PresentedImage })
    return externals.reduce((acc, cur) => {
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
    }, imgEmbeds as FeedEmbeds)
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
