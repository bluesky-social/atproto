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
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
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
      const { ref } = ctx.db.db.dynamic
      const feedService = ctx.services.appView.feed(ctx.db)

      let feedItemsQb = requester
        ? await getFeedItemsQbWithAccess(ctx, { requester, actor })
        : getFeedItemsQbBasic(ctx, { actor })

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
        includeSoftDeleted: auth.credentials.type === 'role', // show takendown content to mods
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

function getFeedItemsQbBasic(ctx: AppContext, opts: { actor: string }) {
  const { actor } = opts
  const feedService = ctx.services.appView.feed(ctx.db)
  const userLookupCol = actor.startsWith('did:')
    ? 'did_handle.did'
    : 'did_handle.handle'
  const actorDidQb = ctx.db.db
    .selectFrom('did_handle')
    .select('did')
    .where(userLookupCol, '=', actor)
    .limit(1)
  return feedService.selectFeedItemQb().where('originatorDid', '=', actorDidQb)
}

async function getFeedItemsQbWithAccess(
  ctx: AppContext,
  opts: { requester: string; actor: string },
) {
  const { requester, actor } = opts
  const { ref } = ctx.db.db.dynamic
  const accountService = ctx.services.account(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)
  // check for block between the two users
  const blocks = await graphService.getBlocks(requester, actor)
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
  // feed items qb, also applying blocks and mutes
  return getFeedItemsQbBasic(ctx, { actor })
    .where((qb) =>
      // Hide reposts of muted content
      qb
        .where('type', '=', 'post')
        .orWhere((qb) =>
          accountService.whereNotMuted(qb, requester, [ref('post.creator')]),
        ),
    )
    .whereNotExists(graphService.blockQb(requester, [ref('post.creator')]))
}
