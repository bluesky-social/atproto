import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@adxp/xrpc-server'
import * as GetAuthorFeed from '../../../lexicon/types/todo/social/getAuthorFeed'
import { PostIndex } from '../../../db/records/post'
import * as locals from '../../../locals'
import {
  queryPostsAndRepostsAsFeedItems,
  queryPostsWithReposts,
  queryResultToFeedItem,
} from './util'
import { postOrRepostIndexedAtClause } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getAuthorFeed(
    async (params: GetAuthorFeed.QueryParams, _input, req, res) => {
      const { author, limit, before } = params

      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const builder = db.db.createQueryBuilder().from(PostIndex, 'post')

      const authorWhere = author.startsWith('did:')
        ? 'originator.did'
        : 'originator.username'

      // Determine result set of posts and reposts
      queryPostsWithReposts(builder).where(`${authorWhere} = :author`, {
        author,
      })

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
      const feed: GetAuthorFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
