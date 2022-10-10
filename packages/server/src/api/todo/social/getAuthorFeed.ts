import { sql } from 'kysely'
import { AuthRequiredError } from '@adxp/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetAuthorFeed from '../../../lexicon/types/todo/social/getAuthorFeed'
import * as locals from '../../../locals'
import { queryResultToFeedItem } from './util'
import {
  isNotRepostClause,
  postOrRepostIndexedAtClause,
} from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getAuthorFeed(
    async (params: GetAuthorFeed.QueryParams, _input, req, res) => {
      const { author, limit, before } = params

      const { auth, db } = locals.get(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const authorIsDid = author.startsWith('did:')

      // @TODO break this query up, share parts with home feed
      const builder = db.db
        .selectFrom('todo_social_post as post')
        // Determine result set of posts and reposts
        .leftJoin('todo_social_repost as repost', 'repost.subject', 'post.uri')
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
          'todo_social_profile as author_profile',
          'author_profile.creator',
          'author.did',
        )
        .leftJoin('user as reposted_by', 'reposted_by.did', 'repost.subject')
        .leftJoin(
          'todo_social_profile as reposted_by_profile',
          'reposted_by_profile.creator',
          'reposted_by.did',
        )
        .leftJoin('record', 'record.uri', 'post.uri')
        .leftJoin(
          db.db
            .selectFrom('todo_social_like')
            .select([
              'todo_social_like.subject as subject',
              db.db.fn.count('todo_social_like.uri').as('count'),
            ])
            .groupBy('subject')
            .as('like_count'),
          'like_count.subject',
          'post.uri',
        )
        .leftJoin(
          db.db
            .selectFrom('todo_social_repost')
            .select([
              'todo_social_repost.subject as subject',
              db.db.fn.count('todo_social_repost.uri').as('count'),
            ])
            .groupBy('subject')
            .as('repost_count'),
          'repost_count.subject',
          'post.uri',
        )
        .leftJoin(
          db.db
            .selectFrom('todo_social_post')
            .select([
              'todo_social_post.replyParent as subject',
              db.db.fn.count('todo_social_post.uri').as('count'),
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
          'author.did as authorDid',
          'author.username as authorName',
          'author_profile.displayName as authorDisplayName',
          'reposted_by.did as repostedByDid',
          'reposted_by.username as repostedByName',
          'reposted_by_profile.displayName as repostedByDisplayName',
          sql`${isNotRepostClause}`.as('isNotRepost'),
          'record.raw as rawRecord',
          'like_count.count as likeCount',
          'repost_count.count as repostCount',
          'reply_count.count as replyCount',
          'requester_repost.uri as requesterRepost',
          'requester_like.uri as requesterLike',
          'record.indexedAt as indexedAt',
          sql`${postOrRepostIndexedAtClause}`.as('cursor'),
        ])
        // Grouping by post then originator preserves one row for each
        // post or repost. Reposts of a given post only vary by originator.
        .groupBy(['post.uri', 'originator.did'])
        // Apply pagination
        .orderBy(postOrRepostIndexedAtClause, 'desc')
        .if(before !== undefined, (qb) =>
          qb.where(postOrRepostIndexedAtClause, '<', before as string),
        )
        .if(limit !== undefined, (qb) => qb.limit(limit as number))

      const queryRes = await builder.execute()
      const feed: GetAuthorFeed.FeedItem[] = queryRes.map(queryResultToFeedItem)

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
