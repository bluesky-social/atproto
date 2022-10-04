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

      // Posts by or reposted by a follower of requester, and not by requester.

      const builder = db.db.createQueryBuilder().from(PostIndex, 'post')

      // Determine result set of posts and reposts
      if (feedAlgorithm === FeedAlgorithm.Firehose) {
        queryPostsWithReposts(builder)
      } else if (feedAlgorithm === FeedAlgorithm.ReverseChronological) {
        const followingIdsSubquery = (qb: SelectQueryBuilder<PostIndex>) => {
          return qb
            .subQuery()
            .select('follow.subject')
            .from(FollowIndex, 'follow')
            .where('follow.creator = :did', { did: requester })
            .getQuery()
        }
        queryPostsWithReposts(builder)
          .where((qb) => `originator.did IN ${followingIdsSubquery(qb)}`)
          .andWhere('post.creator != :requester', { requester })
      } else {
        const exhaustiveCheck: never = feedAlgorithm
        throw new Error(`Unhandled case: ${exhaustiveCheck}`)
      }

      // Select data for presentation into FeedItem
      queryPostsAndRepostsAsFeedItems(builder, { requester })
        .orderBy('post.indexedAt', 'DESC')
        .groupBy('post.uri')

      // Apply pagination
      if (before !== undefined) {
        builder.andWhere('post.indexedAt < :before', { before })
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
