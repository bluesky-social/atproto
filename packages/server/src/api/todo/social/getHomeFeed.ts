import { Server } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import * as GetHomeFeed from '../../../lexicon/types/todo/social/getHomeFeed'
import { FollowIndex } from '../../../db/records/follow'
import { PostIndex } from '../../../db/records/post'
import { getLocals } from '../../../util'
import { SelectQueryBuilder } from 'typeorm'
import {
  FeedAlgorithm,
  isEnum,
  queryPostsAndRepostsAsFeedItems,
  queryPostsWithReposts,
  queryResultToFeedItem,
} from './util'
import {
  isNotRepostClause,
  postOrRepostIndexedAtClause,
} from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getHomeFeed(
    async (params: GetHomeFeed.QueryParams, _input, req, res) => {
      const { algorithm, limit, before } = params

      const { auth, db } = getLocals(res)
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

      const builder = db.db.createQueryBuilder().from(PostIndex, 'post')

      // Determine result set of posts and reposts
      if (feedAlgorithm === FeedAlgorithm.Firehose) {
        // All posts, except requester's reposts
        queryPostsWithReposts(builder).where(
          `post.creator != :requester or ${isNotRepostClause}`,
          { requester },
        )
      } else if (feedAlgorithm === FeedAlgorithm.ReverseChronological) {
        // Followee's posts and reposts, and requester's posts
        const followingIdsSubquery = (qb: SelectQueryBuilder<PostIndex>) => {
          return qb
            .subQuery()
            .select('follow.subject')
            .from(FollowIndex, 'follow')
            .where('follow.creator = :did', { did: requester })
            .getQuery()
        }
        queryPostsWithReposts(builder)
          .where(`(post.creator != :requester or ${isNotRepostClause})`, {
            requester,
          })
          .andWhere(
            (qb) => {
              return (
                `(originator.did IN ${followingIdsSubquery(qb)} or ` +
                `originator.did = :requester)`
              )
            },
            { requester },
          )
      } else {
        const exhaustiveCheck: never = feedAlgorithm
        throw new Error(`Unhandled case: ${exhaustiveCheck}`)
      }

      // Select data for presentation into FeedItem
      queryPostsAndRepostsAsFeedItems(builder, { requester })
        // Grouping by post then originator preserves one row for each
        // post or repost. Reposts of a given post only vary by originator.
        .groupBy('post.uri')
        .addGroupBy('originator.did')

      // Apply pagination
      builder.orderBy(postOrRepostIndexedAtClause, 'DESC')
      if (before !== undefined) {
        builder.andWhere(`${postOrRepostIndexedAtClause} < :before`, { before })
      }
      if (limit !== undefined) {
        builder.limit(limit)
      }

      const queryRes = await builder.getRawMany()
      const feed: GetHomeFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
