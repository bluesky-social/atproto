import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import { handleReadAfterWrite } from '../util/read-after-write'
import { authPassthru } from '../../../../../api/com/atproto/admin/util'
import { LocalRecords } from '../../../../../services/local'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getActorLikes({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null

      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getActorLikes(
          params,
          requester
            ? await ctx.serviceAuthHeaders(requester)
            : authPassthru(req),
        )
        if (requester) {
          return await handleReadAfterWrite(ctx, requester, res, getAuthorMunge)
        }
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { actor, limit, cursor } = params

      // for access-based auth, enforce blocks and mutes
      if (requester) {
        await assertNoBlocks(ctx, { requester, actor })
      }

      const { ref } = ctx.db.db.dynamic
      const feedService = ctx.services.appView.feed(ctx.db)

      const userLookupCol = actor.startsWith('did:')
        ? 'did_handle.did'
        : 'did_handle.handle'
      const actorDidQb = ctx.db.db
        .selectFrom('did_handle')
        .select('did')
        .where(userLookupCol, '=', actor)
        .limit(1)

      // defaults to posts, reposts, and replies
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .innerJoin('like', 'like.subject', 'feed_item.uri')
        .where('like.creator', '=', actorDidQb)

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

// throws when there's a block between the two users
async function assertNoBlocks(
  ctx: AppContext,
  opts: { requester: string; actor: string },
) {
  const { requester, actor } = opts
  const graphService = ctx.services.appView.graph(ctx.db)
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
}

const getAuthorMunge = async (
  ctx: AppContext,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  const localSrvc = ctx.services.local(ctx.db)
  const localProf = local.profile
  let feed = original.feed
  // first update any out of date profile pictures in feed
  if (localProf) {
    feed = feed.map((item) => {
      if (item.post.author.did === requester) {
        return {
          ...item,
          post: {
            ...item.post,
            author: localSrvc.updateProfileViewBasic(
              item.post.author,
              localProf.record,
            ),
          },
        }
      } else {
        return item
      }
    })
  }
  feed = await localSrvc.formatAndInsertPostsInFeed(feed, local.posts)
  return {
    ...original,
    feed,
  }
}
