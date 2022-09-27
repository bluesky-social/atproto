import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import { DataSource } from 'typeorm'
import * as GetPostThread from '../../../lexicon/types/todo/social/getPostThread'
import { PostIndex } from '../../../db/records/post'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import * as util from '../../../db/util'
import { LikeIndex } from '../../../db/records/like'
import { RepostIndex } from '../../../db/records/repost'
import { AdxRecord } from '../../../db/record'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getPostThread(
    async (params: GetPostThread.QueryParams, _input, req, res) => {
      const { uri, depth = 6 } = params
      const { auth, db } = getLocals(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const queryRes = await postInfoBuilder(db.db, requester)
        .where('post.uri = :uri', {
          uri,
        })
        .getRawOne()
      if (!queryRes) {
        throw new InvalidRequestError(`Post not found: ${uri}`)
      }

      const thread = rowToPost(queryRes)
      if (depth > 0) {
        thread.replies = await getReplies(db.db, thread, depth - 1, requester)
      }
      if (queryRes.parent !== null) {
        const parentRes = await postInfoBuilder(db.db, requester)
          .where('post.uri = :uri', { uri: queryRes.parent })
          .getRawOne()
        thread.parent = rowToPost(parentRes)
      }

      return {
        encoding: 'application/json',
        body: { thread },
      }
    },
  )
}

const getReplies = async (
  db: DataSource,
  parent: GetPostThread.Post,
  depth: number,
  requester: string,
): Promise<GetPostThread.Post[]> => {
  const res = await postInfoBuilder(db, requester)
    .where('post.replyParent = :uri', { uri: parent.uri })
    .orderBy('post.createdAt', 'DESC')
    .getRawMany()
  const got = await Promise.all(
    res.map(async (row) => {
      const post = rowToPost(row, parent)
      if (depth > 0) {
        post.replies = await getReplies(db, post, depth - 1, requester)
      }
      return post
    }),
  )
  return got
}

// selects all the needed info about a post, just need to supply the `where` clause
const postInfoBuilder = (db: DataSource, requester: string) => {
  return db
    .createQueryBuilder()
    .select([
      'post.uri AS uri',
      'post.replyParent AS parent',
      'author.did AS authorDid',
      'author.username AS authorName',
      'author_profile.displayName AS authorDisplayName',
      'record.raw AS rawRecord',
      'reply_count.count AS replyCount',
      'like_count.count AS likeCount',
      'repost_count.count AS repostCount',
      'record.indexedAt AS indexedAt',
      'requester_repost.uri AS requesterRepost',
      'requester_like.uri AS requesterLike',
    ])
    .from(PostIndex, 'post')
    .innerJoin(AdxRecord, 'record', 'record.uri = post.uri')
    .innerJoin(User, 'author', 'author.did = post.creator')
    .leftJoin(
      ProfileIndex,
      'author_profile',
      'author.did = author_profile.creator',
    )
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
}

// converts the raw SQL output to a Post object
// unfortunately not type-checked since we're dealing with raw SQL, so change with caution!
const rowToPost = (
  row: any,
  parent?: GetPostThread.Post,
): GetPostThread.Post => {
  return {
    uri: row.uri,
    author: {
      did: row.authorDid,
      name: row.authorName,
      displayName: row.authorDisplayName || undefined,
    },
    record: JSON.parse(row.rawRecord),
    parent: parent ? { ...parent } : undefined,
    replyCount: row.replyCount || 0,
    likeCount: row.likeCount || 0,
    repostCount: row.repostCount || 0,
    indexedAt: row.indexedAt,
    myState: {
      repost: row.requesterRepost || undefined,
      like: row.requesterLike || undefined,
    },
  }
}
