import { sql } from 'kysely'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../lexicon'
import * as GetAuthorFeed from '../../../lexicon/types/app/bsky/getAuthorFeed'
import * as locals from '../../../locals'
import { rowToFeedItem } from './util/feed'
import { countAll, paginate } from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getAuthorFeed(
    async (params: GetAuthorFeed.QueryParams, _input, req, res) => {
      const { auth, db } = locals.get(res)
      const { author, limit, before } = params
      const { ref } = db.db.dynamic

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const userLookupCol = author.startsWith('did:')
        ? 'user.did'
        : 'user.username'
      const userQb = db.db
        .selectFrom('user')
        .selectAll()
        .where(userLookupCol, '=', author)

      const postsQb = db.db
        .selectFrom('app_bsky_post')
        .whereExists(
          userQb.whereRef('user.did', '=', ref('app_bsky_post.creator')),
        )
        .select([
          sql<'post' | 'repost'>`${'post'}`.as('type'),
          'uri as postUri',
          'cid as postCid',
          'creator as originatorDid',
          'indexedAt as cursor',
        ])

      const repostsQb = db.db
        .selectFrom('app_bsky_repost')
        .whereExists(
          userQb.whereRef('user.did', '=', ref('app_bsky_repost.creator')),
        )
        .select([
          sql<'post' | 'repost'>`${'repost'}`.as('type'),
          'subject as postUri',
          'subjectCid as postCid',
          'creator as originatorDid',
          'indexedAt as cursor',
        ])

      let postsAndRepostsQb = db.db
        .selectFrom(postsQb.union(repostsQb).as('posts_and_reposts'))
        .innerJoin('app_bsky_post as post', 'post.uri', 'postUri')
        .innerJoin('record', 'record.uri', 'postUri')
        .innerJoin('user as author', 'author.did', 'post.creator')
        .leftJoin(
          'app_bsky_profile as author_profile',
          'author_profile.creator',
          'author.did',
        )
        .innerJoin('user as originator', 'originator.did', 'originatorDid')
        .leftJoin(
          'app_bsky_profile as originator_profile',
          'originator_profile.creator',
          'originatorDid',
        )
        .select([
          'type',
          'postUri',
          'postCid',
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
            .selectFrom('app_bsky_like')
            .whereRef('subject', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('likeCount'),
          db.db
            .selectFrom('app_bsky_repost')
            .whereRef('subject', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('repostCount'),
          db.db
            .selectFrom('app_bsky_post')
            .whereRef('replyParent', '=', ref('postUri'))
            .select(countAll.as('count'))
            .as('replyCount'),
          db.db
            .selectFrom('app_bsky_repost')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('postUri'))
            .select('uri')
            .as('requesterRepost'),
          db.db
            .selectFrom('app_bsky_like')
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

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: queryRes.at(-1)?.cursor,
        },
      }
    },
  )
}
