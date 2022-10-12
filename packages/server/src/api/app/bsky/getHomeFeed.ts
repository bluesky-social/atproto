import { sql } from 'kysely'
import { AuthRequiredError, InvalidRequestError } from '@adxp/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetHomeFeed from '../../../lexicon/types/app/bsky/getHomeFeed'
import * as locals from '../../../locals'
import { FeedAlgorithm, isEnum, queryResultToFeedItem } from './util'
import {
  countClause,
  isNotRepostClause,
  paginate,
  postOrRepostIndexedAtClause,
} from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getHomeFeed(
    async (params: GetHomeFeed.QueryParams, _input, req, res) => {
      const { algorithm, limit, before } = params

      const { auth, db } = locals.get(res)
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

      const { ref } = db.db.dynamic

      // @TODO break this query up, share parts with author feed and post thread
      let builder = db.db
        .selectFrom('app_bsky_post as post')
        // Determine result set of posts and reposts
        .leftJoin('app_bsky_repost as repost', 'repost.subject', 'post.uri')
        .leftJoin('user as originator', (join) =>
          join
            .onRef('originator.did', '=', 'post.creator')
            .orOnRef('originator.did', '=', 'repost.creator'),
        )
        .if(feedAlgorithm === FeedAlgorithm.Firehose, (qb) => {
          return qb.where(
            // The null check handles ANSI nulls
            sql`(repost.creator != ${requester} or repost.creator is null)`,
          )
        })
        .if(feedAlgorithm === FeedAlgorithm.ReverseChronological, (qb) => {
          const followingIdsSubquery = db.db
            .selectFrom('app_bsky_follow as follow')
            .select('follow.subject')
            .where('follow.creator', '=', requester)
          return qb
            .where(
              sql`(repost.creator != ${requester} or repost.creator is null)`,
            )
            .where((qb) =>
              qb
                .where('originator.did', '=', requester)
                .orWhere(`originator.did`, 'in', followingIdsSubquery),
            )
        })
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
      const feed: GetHomeFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
