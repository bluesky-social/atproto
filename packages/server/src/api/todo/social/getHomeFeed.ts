import { sql } from 'kysely'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetHomeFeed from '../../../lexicon/types/todo/social/getHomeFeed'
import * as locals from '../../../locals'
import { isEnum } from './util'
import { FeedAlgorithm, rowToFeedItem } from './util/feed'
import { countAll, paginate } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getHomeFeed(
    async (params: GetHomeFeed.QueryParams, _input, req, res) => {
      const { auth, db } = locals.get(res)
      const { algorithm, limit, before } = params
      const { ref } = db.db.dynamic

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      let feedAlgorithm: FeedAlgorithm
      if (isEnum(FeedAlgorithm, algorithm)) {
        feedAlgorithm = algorithm
      } else if (algorithm === undefined) {
        feedAlgorithm = FeedAlgorithm.ReverseChronological
      } else {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      let postsQb = db.db
        .selectFrom('todo_social_post')
        .select([
          sql<'post' | 'repost'>`${'post'}`.as('type'),
          'uri as postUri',
          'creator as originatorDid',
          'indexedAt as cursor',
        ])

      let repostsQb = db.db
        .selectFrom('todo_social_repost')
        .select([
          sql<'post' | 'repost'>`${'repost'}`.as('type'),
          'subject as postUri',
          'creator as originatorDid',
          'indexedAt as cursor',
        ])

      if (feedAlgorithm === FeedAlgorithm.Firehose) {
        // All posts, except requester's reposts
        repostsQb = repostsQb.where('creator', '!=', requester)
      } else if (feedAlgorithm === FeedAlgorithm.ReverseChronological) {
        // Followee's posts and reposts, and requester's posts
        const followingIdsSubquery = db.db
          .selectFrom('todo_social_follow as follow')
          .select('follow.subject')
          .where('follow.creator', '=', requester)
        repostsQb = repostsQb
          .where('creator', '!=', requester)
          .where('creator', 'in', followingIdsSubquery)
        postsQb = postsQb
          .where('creator', '=', requester)
          .orWhere('creator', 'in', followingIdsSubquery)
      } else {
        const exhaustiveCheck: never = feedAlgorithm
        throw new Error(`Unhandled case: ${exhaustiveCheck}`)
      }

      let postsAndRepostsQb = db.db
        .selectFrom(postsQb.union(repostsQb).as('posts_and_reposts'))
        .innerJoin('todo_social_post as post', 'post.uri', 'postUri')
        .innerJoin('record', 'record.uri', 'postUri')
        .innerJoin('user as author', 'author.did', 'post.creator')
        .leftJoin(
          'todo_social_profile as author_profile',
          'author_profile.creator',
          'author.did',
        )
        .innerJoin('user as originator', 'originator.did', 'originatorDid')
        .leftJoin(
          'todo_social_profile as originator_profile',
          'originator_profile.creator',
          'originatorDid',
        )
        .select([
          'type',
          'postUri',
          'cursor',
          'record.raw as recordRaw',
          'record.indexedAt as indexedAt',
          'author.did as authorDid',
          'author.username as authorName',
          'author_profile.displayName as authorDisplayName',
          'originator.did as originatorDid',
          'originator.username as originatorName',
          'originator_profile.displayName as originatorDisplayName',
          db.db
            .selectFrom('todo_social_like')
            .whereRef('subject', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('likeCount'),
          db.db
            .selectFrom('todo_social_repost')
            .whereRef('subject', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('repostCount'),
          db.db
            .selectFrom('todo_social_post')
            .whereRef('replyParent', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('replyCount'),
          db.db
            .selectFrom('todo_social_repost')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('postUri'))
            .select('uri')
            .as('requesterRepost'),
          db.db
            .selectFrom('todo_social_like')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('postUri'))
            .select('uri')
            .as('requesterLike'),
        ])

      postsAndRepostsQb = paginate(postsAndRepostsQb, {
        limit,
        before,
        by: ref('cursor'),
      })

      const queryRes = await postsAndRepostsQb.execute()
      const feed = queryRes.map(rowToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
