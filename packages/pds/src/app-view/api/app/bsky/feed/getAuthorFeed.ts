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
import { isReasonRepost } from '../../../../../lexicon/types/app/bsky/feed/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      if (await ctx.canProxyRead(req, requester)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getAuthorFeed(
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

      // defaults to posts, reposts, and replies
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', actorDid)

      if (params.filter === 'posts_with_media') {
        feedItemsQb = feedItemsQb
          // and only your own posts/reposts
          .where('post.creator', '=', actorDid)
          // only posts with media
          .whereExists((qb) =>
            qb
              .selectFrom('post_embed_image')
              .select('post_embed_image.postUri')
              .whereRef('post_embed_image.postUri', '=', 'feed_item.postUri'),
          )
      } else if (params.filter === 'posts_no_replies') {
        feedItemsQb = feedItemsQb
          // only posts, no replies
          .where((qb) =>
            qb
              .where('post.replyParent', 'is', null)
              .orWhere('type', '=', 'repost'),
          )
      }

      // for access-based auth, enforce blocks and mutes
      if (requester) {
        await assertNoBlocks(ctx, { requester, actor })
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
  // only munge on own feed
  if (!isUsersFeed(original, requester)) {
    return original
  }
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

const isUsersFeed = (feed: OutputSchema, requester: string) => {
  const first = feed.feed.at(0)
  if (!first) return false
  if (!first.reason && first.post.author.did === requester) return true
  if (isReasonRepost(first.reason) && first.reason.by.did === requester)
    return true
  return false
}
