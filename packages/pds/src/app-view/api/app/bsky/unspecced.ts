import { Server } from '../../../../lexicon'
import { FeedKeyset, composeFeed } from './util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow, FeedItemType } from '../../../services/feed'
import { sql } from 'kysely'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, before } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.appView.feed(ctx.db)

      const postsQb = ctx.db.db
        .with('vote_counts', (qb) =>
          qb
            .selectFrom('vote')
            .where('vote.direction', '=', 'up')
            .groupBy('vote.subject')
            .select([sql`count(*)`.as('count'), 'vote.subject']),
        )
        .selectFrom('post')
        .innerJoin('vote_counts', 'vote_counts.subject', 'post.uri')
        .leftJoin('repost', (join) =>
          // this works well for one curating user. reassess if adding more
          join
            .on('repost.creator', '=', 'did:plc:ea2eqamjmtuo6f4rvhl3g6ne')
            .onRef('repost.subject', '=', 'post.uri'),
        )
        .where('vote_counts.count', '>=', 5)
        .orWhere('repost.creator', 'is not', null)
        .select([
          sql<FeedItemType>`${'post'}`.as('type'),
          'post.uri as postUri',
          'post.cid as postCid',
          'post.creator as originatorDid',
          'post.creator as authorDid',
          'post.replyParent as replyParent',
          'post.replyRoot as replyRoot',
          'post.indexedAt as cursor',
        ])

      const keyset = new FeedKeyset(ref('cursor'), ref('postCid'))

      let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
      feedQb = paginate(feedQb, { limit, before, keyset })

      const feedItems: FeedRow[] = await feedQb.execute()
      const feed = await composeFeed(feedService, feedItems, requester)

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}
