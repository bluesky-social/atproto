import { FeedView } from '@adxp/microblog'
import { DataSource, Like } from 'typeorm'
import { FollowIndex } from '../records/follow'
import { PostIndex } from '../records/post'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import * as util from '../util'
import { DbViewPlugin } from '../types'
import { LikeIndex } from '../records/like'
import { RepostIndex } from '../records/repost'
import { AdxRecord } from '../record'
import { FeedItem } from '@adxp/microblog/src/types/FeedView'

const viewId = 'blueskyweb.xyz:FeedView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is FeedView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown, requester: string): Promise<FeedView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }

    // @TODO use params
    const { author, limit, before } = params

    const builder = db.createQueryBuilder()

    if (author === undefined) {
      builder
        .from(UserDid, 'user')
        .innerJoin(FollowIndex, 'follow', 'follow.creator = user.did')
        .innerJoin(PostIndex, 'post', 'post.creator = follow.subject')
        .where('user.did = :did', { did: requester })
    } else {
      builder
        .from(PostIndex, 'post')
        .where('post.creator = :author', { author })
    }

    builder
      .select([
        'post.uri AS uri',
        'author.did AS authorDid',
        'author.username AS authorName',
        'author_profile.displayName AS authorDisplayName',
        'like_count.count AS likeCount',
        'repost_count.count AS repostCount',
        'reply_count.count AS replyCount',
        'requester_repost.doesExist AS requesterHasReposted',
        'requester_like.doesExist AS requesterHasLiked',
        'record.indexedAt AS indexedAt',
      ])
      .leftJoin(UserDid, 'author', 'author.did = post.creator')
      .leftJoin(
        ProfileIndex,
        'author_profile',
        'author_profile.creator = author.did',
      )
      .leftJoin(AdxRecord, 'record', 'record.uri = post.uri')
      .leftJoin(
        util.countSubquery(LikeIndex, 'subject'),
        'like_count',
        'like_count.subject = post.uri',
      )
      .leftJoin(
        util.countSubquery(RepostIndex, 'subject'),
        'repost_count',
        'repost_count.subject = post.uri',
      )
      .leftJoin(
        util.countSubquery(PostIndex, 'replyParent'),
        'reply_count',
        'reply_count.subject = post.uri',
      )
      .leftJoin(
        util.existsByCreatorSubquery(RepostIndex, 'subject', requester),
        'requester_repost',
        'requester_repost.subject = post.uri',
      )
      .leftJoin(
        util.existsByCreatorSubquery(LikeIndex, 'subject', requester),
        'requester_like',
        'requester_like.subject = post.uri',
      )

    if (before !== undefined) {
      builder.andWhere('post.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }

    const res = await builder.getRawMany()

    // @TODO add embeds & reposts
    const feed: FeedItem[] = res.map((row) => ({
      uri: row.uri,
      author: {
        did: row.authorDid,
        name: row.authorName,
        displayName: row.authorDisplayName,
      },
      record: {}, // @TODO get raw record
      replyCount: row.replyCount || 0,
      repostCount: row.repostCount || 0,
      likeCount: row.likeCount || 0,
      indexedAt: row.indexedAt,
      myState: {
        hasReposted: Boolean(row.requesterHasReposted),
        hasLiked: Boolean(row.requesterHasLiked),
      },
    }))

    return { feed }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
