import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@adxp/xrpc-server'
import * as GetAuthorFeed from '../../../lexicon/types/todo/social/getAuthorFeed'
import { PostIndex } from '../../../db/records/post'
import { getLocals } from '../../../util'
import {
  queryPostsAndRepostsAsFeedItems,
  queryPostsWithReposts,
  queryResultToFeedItem,
} from './util'

export default function (server: Server) {
  server.todo.social.getAuthorFeed(
    async (params: GetAuthorFeed.QueryParams, _input, req, res) => {
      const { author, limit, before } = params

      const { auth, db } = getLocals(res)
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
      const feed: GetAuthorFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
