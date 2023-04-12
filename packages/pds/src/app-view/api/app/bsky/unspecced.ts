import { Server } from '../../../../lexicon'
import { FeedKeyset, composeFeed } from './util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../services/feed'
import { FeedViewPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { countAll } from '../../../../db/util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.appView.feed(ctx.db)

      const postsQb = feedService
        .selectPostQb()
        .leftJoin('repost', (join) =>
          // this works well for one curating user. reassess if adding more
          join
            .on('repost.creator', '=', 'did:plc:ea2eqamjmtuo6f4rvhl3g6ne')
            .onRef('repost.subject', '=', 'post.uri'),
        )
        .where((clause) =>
          clause
            .where('repost.creator', 'is not', null)
            .orWhere(
              (qb) =>
                qb
                  .selectFrom('like')
                  .whereRef('like.subject', '=', 'post.uri')
                  .select(countAll.as('count')),
              '>=',
              5,
            ),
        )
        .whereNotExists(
          db
            .selectFrom('mute')
            .selectAll()
            .where('mutedByDid', '=', requester)
            .whereRef('did', '=', ref('post.creator')),
        )

      const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

      let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
      feedQb = paginate(feedQb, { limit, cursor, keyset })

      const feedItems: FeedRow[] = await feedQb.execute()
      const feed: FeedViewPost[] = await composeFeed(
        feedService,
        feedItems,
        requester,
      )

      const noRecordEmbeds = feed.map((post) => {
        delete post.post.record['embed']
        if (post.reply) {
          delete post.reply.parent.record['embed']
          delete post.reply.root.record['embed']
        }
        return post
      })

      return {
        encoding: 'application/json',
        body: {
          feed: noRecordEmbeds,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}
