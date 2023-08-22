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

      if (await ctx.canProxyRead(req, requester)) {
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

      const { ref } = ctx.db.db.dynamic
      const accountService = ctx.services.account(ctx.db)
      const actorService = ctx.services.appView.actor(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      // maybe resolve did first
      const actorRes = await actorService.getActor(actor)
      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      const actorDid = actorRes.did

      if (!requester || requester !== actorDid) {
        throw new InvalidRequestError('Profile not found')
      }

      // defaults to posts, reposts, and replies
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .innerJoin('like', 'like.subject', 'feed_item.uri')
        .where('like.creator', '=', actorDid)

      // for access-based auth, enforce blocks
      if (requester) {
        feedItemsQb = feedItemsQb.whereNotExists(
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
