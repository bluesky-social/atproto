import { Server } from '../../../../../lexicon'
import { FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { FeedViewPost } from '../../../../../lexicon/types/app/bsky/feed/defs'
import { countAll } from '../../../../../db/util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.fromNetwork({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.appView.feed(ctx.db)
      const actorService = ctx.services.appView.actor(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const postsQb = feedService
        .selectFeedItemQb()
        .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
        .where((qb) =>
          qb
            // select all posts/reposts from a follow that have >= 5 likes
            .where((fromFollows) =>
              fromFollows
                .where((followsInner) =>
                  followsInner
                    .where('originatorDid', '=', requester)
                    .orWhereExists(
                      db
                        .selectFrom('follow')
                        .where('follow.creator', '=', requester)
                        .whereRef(
                          'follow.subjectDid',
                          '=',
                          ref('originatorDid'),
                        ),
                    ),
                )
                .where('post_agg.likeCount', '>=', 5),
            )
            // and all posts from the network that have >= 5 likes from *your* follows
            .orWhere((fromAll) =>
              fromAll.where('feed_item.type', '=', 'post').where(
                db
                  .selectFrom('like')
                  .where('like.subject', '=', 'post.uri')
                  .whereExists(
                    db
                      .selectFrom('follow')
                      .where('follow.creator', '=', requester)
                      .whereRef('follow.subjectDid', '=', ref('like.creator')),
                  )
                  .select(countAll.as('count')),
                '>=',
                5,
              ),
            ),
        )
        .whereNotExists(
          db
            .selectFrom('mute')
            .selectAll()
            .where('mutedByDid', '=', requester)
            .whereRef('did', '=', ref('post.creator')),
        )
        .whereNotExists(actorService.blockQb(requester, [ref('post.creator')]))

      const keyset = new FeedKeyset(ref('sortAt'), ref('cid'))

      let feedQb = ctx.db.db.selectFrom(postsQb.as('feed_items')).selectAll()
      feedQb = paginate(feedQb, { limit, cursor, keyset })

      const feedItems: FeedRow[] = await feedQb.execute()
      const feed: FeedViewPost[] = await composeFeed(
        feedService,
        labelService,
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
