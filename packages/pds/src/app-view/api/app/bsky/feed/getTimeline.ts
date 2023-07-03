import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxy(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getTimeline(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { algorithm, limit, cursor } = params
      const db = ctx.db.db
      const { ref } = db.dynamic

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      const subKeyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
      const mainKeyset = new FeedKeyset(ref('sortAt'), ref('cid'))
      const sortFrom = mainKeyset.unpack(cursor)?.primary

      // my feed items
      let myFeedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', requester)

      myFeedItemsQb = paginate(myFeedItemsQb, {
        limit,
        cursor,
        keyset: subKeyset,
        tryIndex: true,
      })

      // follows feed items
      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      let followFeedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', 'in', followingIdsSubquery)
        .where((qb) =>
          // Hide posts and reposts of or by muted actors
          accountService.whereNotMuted(qb, requester, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .whereNotExists(
          graphService.blockQb(requester, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))

      followFeedItemsQb = paginate(followFeedItemsQb, {
        limit,
        cursor,
        keyset: subKeyset,
        tryIndex: true,
      })

      // combine my and follow feed items
      const emptyQb = feedService.selectFeedItemQb().where(sql`1 = 0`)

      let allFeedItemsQb = db
        .selectFrom(
          emptyQb
            .unionAll(sql`${myFeedItemsQb}`)
            .unionAll(sql`${followFeedItemsQb}`)
            .as('final_items'),
        )
        .selectAll()
      allFeedItemsQb = paginate(allFeedItemsQb, {
        limit,
        cursor,
        keyset: mainKeyset,
        tryIndex: true,
      })

      const feedItems: FeedRow[] = await allFeedItemsQb.execute()
      const feed = await feedService.hydrateFeed(feedItems, requester)

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: mainKeyset.packFromResult(feedItems),
        },
      }
    },
  })
}
