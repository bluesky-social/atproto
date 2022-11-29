import { Kysely } from 'kysely'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as common from '@atproto/common'
import { Server } from '../../../../lexicon'
import * as GetPostThread from '../../../../lexicon/types/app/bsky/feed/getPostThread'
import * as locals from '../../../../locals'
import { DatabaseSchema } from '../../../../db/database-schema'
import { countAll } from '../../../../db/util'
import { getDeclaration } from '../util'

export default function (server: Server) {
  server.app.bsky.feed.getPostThread(
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
        throw new InvalidRequestError(`Post not found: ${uri}`, 'NotFound')
      }

      const thread = rowToPost(queryRes)
      if (depth > 0) {
        thread.replies = await getReplies(db.db, thread, depth - 1, requester)
      }
      if (queryRes.parent !== null) {
        thread.parent = await getAncestors(db.db, queryRes.parent, requester)
      }

      return {
        encoding: 'application/json',
        body: { thread },
      }
    },
  )
}

const getAncestors = async (
  db: Kysely<DatabaseSchema>,
  parentUri: string,
  requester: string,
): Promise<GetPostThread.Post> => {
  const parentRes = await postInfoBuilder(db, requester)
    .where('post.uri', '=', parentUri)
    .executeTakeFirstOrThrow()
  const parentObj = rowToPost(parentRes)
  if (parentRes.parent !== null) {
    parentObj.parent = await getAncestors(db, parentRes.parent, requester)
  }
  return parentObj
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
  const { ref } = db.dynamic
  return db
    .selectFrom('post')
    .innerJoin('ipld_block', 'ipld_block.cid', 'post.cid')
    .innerJoin('did_handle as author', 'author.did', 'post.creator')
    .leftJoin(
      'profile as author_profile',
      'author.did',
      'author_profile.creator',
    )
    .select([
      'post.uri as uri',
      'post.cid as cid',
      'post.replyParent as parent',
      'author.did as authorDid',
      'author.declarationCid as authorDeclarationCid',
      'author.actorType as authorActorType',
      'author.handle as authorHandle',
      'author_profile.displayName as authorDisplayName',
      'ipld_block.content as recordBytes',
      'ipld_block.indexedAt as indexedAt',
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
        .select(countAll.as('count'))
        .whereRef('subject', '=', ref('post.uri'))
        .as('repostCount'),
      db
        .selectFrom('post as reply')
        .select(countAll.as('count'))
        .whereRef('replyParent', '=', ref('post.uri'))
        .as('replyCount'),
      db
        .selectFrom('repost')
        .select('uri')
        .where('creator', '=', requester)
        .whereRef('subject', '=', ref('post.uri'))
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
}

// converts the raw SQL output to a Post object
// unfortunately not type-checked yet, so change with caution!
const rowToPost = (
  row: any,
  parent?: GetPostThread.Post,
): GetPostThread.Post => {
  return {
    uri: row.uri,
    cid: row.cid,
    author: {
      did: row.authorDid,
      declaration: getDeclaration('author', row),
      handle: row.authorHandle,
      displayName: row.authorDisplayName || undefined,
    },
    record: common.ipldBytesToRecord(row.recordBytes),
    parent: parent ? { ...parent } : undefined,
    replyCount: row.replyCount || 0,
    upvoteCount: row.upvoteCount || 0,
    downvoteCount: row.downvoteCount || 0,
    repostCount: row.repostCount || 0,
    indexedAt: row.indexedAt,
    myState: {
      repost: row.requesterRepost || undefined,
      upvote: row.requesterUpvote || undefined,
      downvote: row.requesterDownvote || undefined,
    },
  }
}
