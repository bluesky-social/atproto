import { AuthRequiredError } from '@adxp/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetAuthorFeed from '../../../lexicon/types/app/bsky/getAuthorFeed'
import * as locals from '../../../locals'
import { queryResultToFeedItem } from './util'
import {
  countClause,
  isNotRepostClause,
  paginate,
  postOrRepostIndexedAtClause,
} from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getAuthorFeed(
    async (params: GetAuthorFeed.QueryParams, _input, req, res) => {
      const { author, limit, before } = params

      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const { ref } = db.db.dynamic
      const authorIsDid = author.startsWith('did:')

      // @TODO break this query up, share parts with home feed and post thread
      let builder = db.db
        .selectFrom('app_bsky_post as post')
        // Determine result set of posts and reposts
        .leftJoin('app_bsky_repost as repost', 'repost.subject', 'post.uri')
        .leftJoin('user as originator', (join) =>
          join
            .onRef('originator.did', '=', 'post.creator')
            .orOnRef('originator.did', '=', 'repost.creator'),
        )
        .if(authorIsDid, (qb) => qb.where('originator.did', '=', author))
        .if(!authorIsDid, (qb) => qb.where('originator.username', '=', author))
        // Select data for presentation into FeedItem
        .leftJoin('user as author', 'author.did', 'post.creator')
        .leftJoin(
          'app_bsky_profile as author_profile',
          'author_profile.creator',
          'author.did',
        )
        .leftJoin('user as reposted_by', 'reposted_by.did', 'repost.creator')
        .leftJoin(
          'app_bsky_profile as reposted_by_profile',
          'reposted_by_profile.creator',
          'reposted_by.did',
        )
        .leftJoin('record', 'record.uri', 'post.uri')
        .select([
          'post.uri as uri',
          'record.raw as rawRecord',
          'record.indexedAt as indexedAt',
          'author.did as authorDid',
          'author.username as authorName',
          'author_profile.displayName as authorDisplayName',
          'reposted_by.did as repostedByDid',
          'reposted_by.username as repostedByName',
          'reposted_by_profile.displayName as repostedByDisplayName',
          isNotRepostClause.as('isNotRepost'),
          postOrRepostIndexedAtClause.as('cursor'),
          db.db
            .selectFrom('app_bsky_like')
            .whereRef('subject', '=', ref('post.uri'))
            .select(countClause.as('count'))
            .as('likeCount'),
          db.db
            .selectFrom('app_bsky_repost')
            .whereRef('subject', '=', ref('post.uri'))
            .select(countClause.as('count'))
            .as('repostCount'),
          db.db
            .selectFrom('app_bsky_post')
            .whereRef('replyParent', '=', ref('post.uri'))
            .select(countClause.as('count'))
            .as('replyCount'),
          db.db
            .selectFrom('app_bsky_repost')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('post.uri'))
            .select('uri')
            .as('requesterRepost'),
          db.db
            .selectFrom('app_bsky_like')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('post.uri'))
            .select('uri')
            .as('requesterLike'),
        ])
        // Grouping by post then originator preserves one row for each
        // post or repost. Reposts of a given post only vary by originator.
        .groupBy(['post.uri', 'originator.did'])

      // Apply pagination
      builder = paginate(builder, {
        limit,
        before,
        by: postOrRepostIndexedAtClause,
      })

      const queryRes = await builder.execute()
      const feed: GetAuthorFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
