import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@adxp/xrpc-server'
import * as GetHomeFeed from '../../../lexicon/types/todo/social/getHomeFeed'
import { FollowIndex } from '../../../db/records/follow'
import { PostIndex } from '../../../db/records/post'
import { getLocals } from '../../../util'
import { SelectQueryBuilder } from 'typeorm'
import {
  queryPostsAndRepostsAsFeedItems,
  queryPostsWithReposts,
  queryResultToFeedItem,
} from './util'

export default function (server: Server) {
  server.todo.social.getHomeFeed(
    async (params: GetHomeFeed.QueryParams, _input, req, res) => {
      const { limit, before /*, algorithm @TODO */ } = params

      const { auth, db } = getLocals(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      // Posts by or reposted by a follower of requester, and not by requester.

      const builder = db.db.createQueryBuilder().from(PostIndex, 'post')

      const followingIdsSubquery = (qb: SelectQueryBuilder<PostIndex>) => {
        return qb
          .subQuery()
          .select('follow.subject')
          .from(FollowIndex, 'follow')
          .where('follow.creator = :did', { did: requester })
          .getQuery()
      }

      // Determine result set of posts and reposts
      queryPostsWithReposts(builder)
        .where((qb) => `originator.did IN ${followingIdsSubquery(qb)}`)
        .andWhere('post.creator != :requester', { requester })

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
