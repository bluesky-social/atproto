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

// @TODO filter out replies??
export const viewFn =
  (db: DataSource) =>
  async (params: unknown, requester: string): Promise<FeedView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }

    const { author, limit, before } = params

    const builder = db.createQueryBuilder()

    if (author === undefined) {
      builder
        .from(UserDid, 'user')
        .innerJoin(FollowIndex, 'follow', 'follow.creator = user.did')
        .leftJoin(RepostIndex, 'repost', 'repost.creator = follow.subject')
        .innerJoin(
          PostIndex,
          'post',
          'post.creator = follow.subject OR post.uri = repost.subject',
        )
        .where('user.did = :did', { did: requester })
    } else {
      builder
        .from(PostIndex, 'post')
        .leftJoin(RepostIndex, 'repost', 'repost.subject = post.uri')
        .where('post.creator = :author', { author })
        .orWhere('repost.creator = :author', { author })
    }

    builder
      .select([
        'post.uri AS uri',
        'author.did AS authorDid',
        'author.username AS authorName',
        'author_profile.displayName AS authorDisplayName',
        'reposted_by.did AS repostedByDid',
        'reposted_by.username AS repostedByName',
        'reposted_by_profile.displayName AS repostedByDisplayName',
        'record.raw AS rawRecord',
        'like_count.count AS likeCount',
        'repost_count.count AS repostCount',
        'reply_count.count AS replyCount',
        'requester_repost.uri AS requesterRepost',
        'requester_like.uri AS requesterLike',
        'record.indexedAt AS indexedAt',
      ])
      .leftJoin(UserDid, 'author', 'author.did = post.creator')
      .leftJoin(
        ProfileIndex,
        'author_profile',
        'author_profile.creator = author.did',
      )
      .leftJoin(UserDid, 'reposted_by', 'reposted_by.did = repost.creator')
      .leftJoin(
        ProfileIndex,
        'reposted_by_profile',
        'reposted_by_profile.creator = reposted_by.did',
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
        RepostIndex,
        'requester_repost',
        `requester_repost.creator = :requester AND requester_repost.subject = post.uri`,
        { requester },
      )
      .leftJoin(
        RepostIndex,
        'requester_like',
        `requester_like.creator = :requester AND requester_like.subject = post.uri`,
        { requester },
      )

    if (before !== undefined) {
      builder.andWhere('post.createdAt < :before', { before })
    }
    if (limit !== undefined) {
      builder.limit(limit)
    }

    const res = await builder.getRawMany()

    // @TODO add embeds
    const feed: FeedItem[] = res.map((row) => ({
      uri: row.uri,
      author: {
        did: row.authorDid,
        name: row.authorName,
        displayName: row.authorDisplayName || undefined,
      },
      repostedBy: row.repostedByDid
        ? {
            did: row.repostedByDid,
            name: row.repostedByName,
            displayName: row.repostedByDisplayName || undefined,
          }
        : undefined,
      record: JSON.parse(row.rawRecord),
      replyCount: row.replyCount || 0,
      repostCount: row.repostCount || 0,
      likeCount: row.likeCount || 0,
      indexedAt: row.indexedAt,
      myState: {
        repost: row.requesterRepost || undefined,
        like: row.requesterLike || undefined,
      },
    }))

    return { feed }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
