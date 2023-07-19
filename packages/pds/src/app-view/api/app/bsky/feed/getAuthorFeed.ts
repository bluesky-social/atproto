import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = 'did' in auth.credentials ? auth.credentials.did : null
      const isRoleBasedAuth = !('did' in auth.credentials)
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getAuthorFeed(
          params,
          requester
            ? await ctx.serviceAuthHeaders(requester)
            : {
                // @TODO use authPassthru() once it lands
                headers: req.headers.authorization
                  ? { authorization: req.headers.authorization }
                  : {},
              },
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { actor, limit, cursor } = params
      const db = ctx.db.db
      const { ref } = db.dynamic

      // first verify there is not a block between requester & subject
      if (requester) {
        const blocks = await ctx.services.appView
          .graph(ctx.db)
          .getBlocks(requester, actor)
        if (blocks.blocking) {
          throw new InvalidRequestError(
            `Requester has blocked actor: ${actor}`,
            'BlockedActor',
          )
        } else if (blocks.blockedBy) {
          throw new InvalidRequestError(
            `Requester is blocked by actor: $${actor}`,
            'BlockedByActor',
          )
        }
      }

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      const userLookupCol = actor.startsWith('did:')
        ? 'did_handle.did'
        : 'did_handle.handle'
      const actorDidQb = db
        .selectFrom('did_handle')
        .select('did')
        .where(userLookupCol, '=', actor)
        .limit(1)

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', actorDidQb)

      if (requester) {
        feedItemsQb = feedItemsQb
          .where((qb) =>
            // Hide reposts of muted content
            qb
              .where('type', '=', 'post')
              .orWhere((qb) =>
                accountService.whereNotMuted(qb, requester, [
                  ref('post.creator'),
                ]),
              ),
          )
          .whereNotExists(
            graphService.blockQb(requester, [ref('post.creator')]),
          )
      }

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
      })

      const feedItems: FeedRow[] = await feedItemsQb.execute()
      const feed = await feedService.hydrateFeed(feedItems, requester, {
        includeSoftDeleted: isRoleBasedAuth,
      })

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
