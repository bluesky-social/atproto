import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { filterMutesAndBlocks } from './getFeed'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/feed/getTimeline'
import { ApiRes, formatLocalPostView, getClock } from '../util/read-after-write'
import { ids } from '../../../../../lexicon/lexicons'
import { PostView } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { FeedViewPost } from '../../../../../lexicon/types/app/bsky/feed/defs'
import { Record as PostRecord } from '../../../../../lexicon/types/app/bsky/feed/post'
import { RecordDescript } from '../../../../../services/local'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      const { algorithm, limit, cursor } = params
      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getTimeline(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: await ensureReadAfterWrite(ctx, requester, res),
        }
      }

      if (ctx.cfg.bskyAppViewEndpoint) {
        const res =
          await ctx.appviewAgent.api.app.bsky.unspecced.getTimelineSkeleton(
            { limit, cursor },
            await ctx.serviceAuthHeaders(requester),
          )
        const filtered = await filterMutesAndBlocks(
          ctx,
          res.data,
          limit,
          requester,
        )
        const hydrated = await ctx.services.appView
          .feed(ctx.db)
          .hydrateFeed(filtered.feedItems, requester)
        return {
          encoding: 'application/json',
          body: {
            cursor: filtered.cursor,
            feed: hydrated,
          },
        }
      }

      const db = ctx.db.db
      const { ref } = db.dynamic

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
      const sortFrom = keyset.unpack(cursor)?.primary

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where((qb) =>
          qb
            .where('originatorDid', '=', requester)
            .orWhere('originatorDid', 'in', followingIdsSubquery),
        )
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

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
        tryIndex: true,
      })

      const feedItems: FeedRow[] = await feedItemsQb.execute()
      const feed = await feedService.hydrateFeed(feedItems, requester)

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

const ensureReadAfterWrite = async (
  ctx: AppContext,
  requester: string,
  res: ApiRes<OutputSchema>,
): Promise<OutputSchema> => {
  const clock = getClock(res.headers)
  if (!clock) return res.data
  const local = await ctx.services
    .local(ctx.db)
    .getRecordsSinceClock(requester, clock, [ids.AppBskyFeedPost])
  const formatted = await findAndFormatPostsToInsert(
    ctx,
    local.posts,
    res.data.feed,
  )
  if (formatted.length === 0) return res.data
  const feed = [...res.data.feed]
  for (const post of formatted) {
    if (post === null) continue
    let inserted = false
    for (let i = 0; i < feed.length; i++) {
      if (feed[i].post.indexedAt < post.indexedAt) {
        feed.splice(i, 0, { post })
        inserted = true
        break
      }
    }
    if (!inserted) {
      feed.push({ post })
    }
  }
  return {
    cursor: res.data.cursor,
    feed,
  }
}

// ordered most to least recent
const findAndFormatPostsToInsert = async (
  ctx: AppContext,
  posts: RecordDescript<PostRecord>[],
  feed: FeedViewPost[],
): Promise<PostView[]> => {
  const lastTime = feed.at(-1)?.post.indexedAt ?? new Date(0).toISOString()
  const inTimeline = posts.filter((p) => p.indexedAt > lastTime)
  const newestToOldest = inTimeline.reverse()
  const formatted = await Promise.all(
    newestToOldest.map((p) => formatLocalPostView(ctx, p)),
  )
  return formatted.filter((p) => p !== null) as PostView[]
}
