import { Server } from '../../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeeds({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getAuthorFeeds(
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

      const { actors, limit, cursor } = params

      const { ref } = ctx.db.db.dynamic
      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      let feedItemsQb = getFeedItemsQb(ctx, { actors })

      // for access-based auth, enforce blocks and mutes
      if (requester) {
        feedItemsQb = feedItemsQb
          .where((qb) =>
            // hide reposts of muted content
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

function getFeedItemsQb(ctx: AppContext, opts: { actors: string[] }) {
  const { actors } = opts
  const feedService = ctx.services.appView.feed(ctx.db)
  const dids = actors.filter((actor) => actor.startsWith('did:'))
  const handles = actors.filter((actor) => !actor.startsWith('did:'))
  let qb = ctx.db.db.selectFrom('did_handle').select('did_handle.did')
  if (dids.length > 0 && handles.length > 0) {
    qb = qb.where((group) =>
      group
        .where('did_handle.did', 'in', dids)
        .orWhere('handle', 'in', handles),
    )
  } else if (dids.length > 0) {
    qb = qb.where('did_handle.did', 'in', dids)
  } else if (handles.length > 0) {
    qb = qb.where('did_handle.handle', 'in', handles)
  }
  return feedService.selectFeedItemQb().where('originatorDid', 'in', qb)
}
