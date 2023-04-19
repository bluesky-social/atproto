import { sql } from 'kysely'
import { Server } from '../../../lexicon'
import { FeedKeyset, composeFeed } from './util/feed'
import { paginate } from '../../../db/pagination'
import AppContext from '../../../context'
import { FeedRow, FeedItemType } from '../../../services/types'
import { authOptionalVerifier } from '../../auth'
import { countAll } from '../../../db/util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.feed(ctx.db)
      const labelService = ctx.services.label(ctx.db)

      const postsQb = ctx.db.db
        .selectFrom('post')
        .leftJoin('repost', (join) =>
          // this works well for one curating user. reassess if adding more
          join
            .on('repost.creator', '=', 'did:plc:ea2eqamjmtuo6f4rvhl3g6ne')
            .onRef('repost.subject', '=', 'post.uri'),
        )
        .where(
          (qb) =>
            qb
              .selectFrom('like')
              .whereRef('like.subject', '=', 'post.uri')
              .select(countAll.as('count')),
          '>=',
          5,
        )
        .orWhere('repost.creator', 'is not', null)
        .select([
          sql<FeedItemType>`${'post'}`.as('type'),
          'post.uri as uri',
          'post.cid as cid',
          'post.uri as postUri',
          'post.creator as postAuthorDid',
          'post.creator as originatorDid',
          'post.replyParent as replyParent',
          'post.replyRoot as replyRoot',
          'post.indexedAt as sortAt',
        ])

      const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

      let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
      feedQb = paginate(feedQb, { limit, cursor, keyset })

      const feedItems: FeedRow[] = await feedQb.execute()
      const feed = await composeFeed(
        feedService,
        labelService,
        feedItems,
        requester,
      )

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
