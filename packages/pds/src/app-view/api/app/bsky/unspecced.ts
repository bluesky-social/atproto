import { Server } from '../../../../lexicon'
import { FeedKeyset, composeFeed } from './util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../services/feed'
import { FeedViewPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { NotEmptyArray } from '@atproto/common'

const NO_WHATS_HOT_LABELS: NotEmptyArray<string> = [
  '!no-promote',
  'corpse',
  'self-harm',
]

const NSFW_LABELS = ['porn', 'sexual', 'nudity']

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor, includeNsfw } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.appView.feed(ctx.db)
      const actorService = ctx.services.appView.actor(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const labelsToFilter = includeNsfw
        ? NO_WHATS_HOT_LABELS
        : [...NO_WHATS_HOT_LABELS, ...NSFW_LABELS]

      const postsQb = feedService
        .selectPostQb()
        .leftJoin('post_agg', 'post_agg.uri', 'post.uri')
        .where('post_agg.likeCount', '>=', 12)
        .where('post.replyParent', 'is', null)
        .whereNotExists((qb) =>
          qb
            .selectFrom('post_embed_record')
            .selectAll()
            .whereRef('post_embed_record.postUri', '=', ref('post.uri')),
        )
        .whereNotExists((qb) =>
          qb
            .selectFrom('label')
            .selectAll()
            .where('val', 'in', labelsToFilter)
            .where('neg', '=', 0)
            .where((clause) =>
              clause
                .whereRef('label.uri', '=', ref('post.creator'))
                .orWhereRef('label.uri', '=', ref('post.uri')),
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

      return {
        encoding: 'application/json',
        body: {
          feed: feed,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}
