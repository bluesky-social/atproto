import { Kysely } from 'kysely'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetPostThread from '../../../lexicon/types/todo/social/getPostThread'
import * as locals from '../../../locals'
import { DatabaseSchema } from '../../../db/database-schema'

export default function (server: Server) {
  server.todo.social.getPostThread(
    async (params: GetPostThread.QueryParams, _input, req, res) => {
      const { uri, depth = 6 } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const queryRes = await postInfoBuilder(db.db, requester)
        .where('post.uri', '=', uri)
        .executeTakeFirst()

      if (!queryRes) {
        throw new InvalidRequestError(`Post not found: ${uri}`)
      }

      const thread = rowToPost(queryRes)
      if (depth > 0) {
        thread.replies = await getReplies(db.db, thread, depth - 1, requester)
      }
      if (queryRes.parent !== undefined) {
        const parentRes = await postInfoBuilder(db.db, requester)
          .where('post.uri', '=', queryRes.parent)
          .executeTakeFirstOrThrow()
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
  db: Kysely<DatabaseSchema>,
  parent: GetPostThread.Post,
  depth: number,
  requester: string,
): Promise<GetPostThread.Post[]> => {
  const res = await postInfoBuilder(db, requester)
    .where('post.replyParent', '=', parent.uri)
    .orderBy('post.createdAt', 'desc')
    .execute()
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
// @TODO break this query up, share parts with home/author feeds
const postInfoBuilder = (db: Kysely<DatabaseSchema>, requester: string) => {
  return db
    .selectFrom('todo_social_post as post')
    .innerJoin('record', 'record.uri', 'post.uri')
    .innerJoin('user as author', 'author.did', 'post.creator')
    .leftJoin(
      'todo_social_profile as author_profile',
      'author.did',
      'author_profile.creator',
    )
    .leftJoin(
      db
        .selectFrom('todo_social_like')
        .select([
          'todo_social_like.subject as subject',
          db.fn.count('todo_social_like.uri').as('count'),
        ])
        .groupBy('subject')
        .as('like_count'),
      'like_count.subject',
      'post.uri',
    )
    .leftJoin(
      db
        .selectFrom('todo_social_repost')
        .select([
          'todo_social_repost.subject as subject',
          db.fn.count('todo_social_repost.uri').as('count'),
        ])
        .groupBy('subject')
        .as('repost_count'),
      'repost_count.subject',
      'post.uri',
    )
    .leftJoin(
      db
        .selectFrom('todo_social_post')
        .select([
          'todo_social_post.replyParent as subject',
          db.fn.count('todo_social_post.uri').as('count'),
        ])
        .groupBy('subject')
        .as('reply_count'),
      'reply_count.subject',
      'post.uri',
    )
    .leftJoin('todo_social_repost as requester_repost', (join) =>
      join
        .on('requester_repost.creator', '=', requester)
        .onRef('requester_repost.subject', '=', 'post.uri'),
    )
    .leftJoin('todo_social_like as requester_like', (join) =>
      join
        .on('requester_like.creator', '=', requester)
        .onRef('requester_like.subject', '=', 'post.uri'),
    )
    .select([
      'post.uri as uri',
      'post.replyParent as parent',
      'author.did as authorDid',
      'author.username as authorName',
      'author_profile.displayName as authorDisplayName',
      'record.raw as rawRecord',
      'reply_count.count as replyCount',
      'like_count.count as likeCount',
      'repost_count.count as repostCount',
      'record.indexedAt as indexedAt',
      'requester_repost.uri as requesterRepost',
      'requester_like.uri as requesterLike',
    ])
}

// converts the raw SQL output to a Post object
// unfortunately not type-checked yet, so change with caution!
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
