import { mapDefined } from '@atproto/common'
import type { DidString } from '@atproto/lex-schema'
import { AtUri } from '@atproto/syntax'
import type { Headers as HeadersMap } from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import { Gate } from '../../../../feature-gates/gates.js'
import type { FeedItem } from '../../../../hydration/feed.js'
import type {
  HydrateCtx,
  HydrationState,
} from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import type { Views } from '../../../../views/index.js'

export const filterBlocksAndMutesOnFeed = <T extends FeedItem>(
  ctx: { views: Views },
  items: T[],
  hydration: HydrationState,
): T[] =>
  items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.authorQuotepostMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
      !bam.originatorRepostMuted &&
      !bam.ancestorAuthorBlocked
    )
  })

export const presentFeedItems = (
  ctx: { views: Views },
  items: AlgoResponseItem[],
  hydration: HydrationState,
  reqId?: string,
) =>
  mapDefined(items, (item) => {
    const post = ctx.views.feedViewPost(item, hydration)
    if (!post) return
    return {
      ...post,
      feedContext: item.feedContext,
      reqId,
    }
  })

/**
 * Per-feed rollout gates for the iris cutover, keyed by feed rkey.
 * Allowlisted feeds without a dedicated gate (whats-hot) use Gate.IrisFeed.
 */
const IRIS_FEED_RKEY_GATES: Record<string, Gate> = {
  'with-friends': Gate.IrisFeedWithFriendsEnable,
  thevids: Gate.IrisFeedThevidsEnable,
  mutuals: Gate.IrisFeedMutualsEnable,
  'bsky-team': Gate.IrisFeedBskyTeamEnable,
  'best-of-follows': Gate.IrisFeedBestOfFollowsEnable,
  followpics: Gate.IrisFeedFollowpicsEnable,
}

/**
 * Iris' endpoint, when it should serve this request in place of the feed's
 * registered feed generator (seeemore).
 *
 * Logged-in viewers are routed by their per-feed gate. Logged-out viewers
 * have no DID, but the client sends a stable device id (stable_id) that
 * GrowthBook can bucket on, so they are routed by the dedicated
 * Gate.IrisFeedLoggedOutEnable gate instead. Requests without a stable
 * device id are never routed: the feature-gates context falls back to a
 * random id per request, which would flip backends between pages and send a
 * cursor to the backend that did not mint it.
 */
export const irisUrlForFeed = (
  cfg: Pick<ServerConfig, 'irisUrl' | 'irisFeedUris'>,
  params: {
    feed: string
    stableDeviceId: string | null
    hydrateCtx: {
      viewer: HydrateCtx['viewer']
      features: Pick<HydrateCtx['features'], 'Gate' | 'checkGate'>
    }
  },
): string | undefined => {
  const { irisUrl } = cfg
  if (!irisUrl) return
  if (!cfg.irisFeedUris?.has(params.feed)) return
  if (!params.hydrateCtx.viewer) {
    if (!params.stableDeviceId) return
    return params.hydrateCtx.features.checkGate(Gate.IrisFeedLoggedOutEnable)
      ? irisUrl
      : undefined
  }
  const rkey = params.feed.split('/').at(-1)
  const gate = (rkey && IRIS_FEED_RKEY_GATES[rkey]) || Gate.IrisFeed
  if (!params.hydrateCtx.features.checkGate(gate)) {
    return
  }
  return irisUrl
}

/**
 * Iris staging's endpoint, when it should serve this request in place of the
 * feed's registered feed generator.
 */
export const irisStagingUrlForFeed = (
  cfg: Pick<ServerConfig, 'irisStagingUrl' | 'irisStagingFeedUris'>,
  params: { feed: string },
): string | undefined =>
  cfg.irisStagingFeedUris?.has(params.feed) ? cfg.irisStagingUrl : undefined

/**
 * Iris' local endpoint for configured trending feeds registered to Iris.
 */
export function irisUrlForTrendingFeed(
  cfg: Pick<ServerConfig, 'irisUrl' | 'irisServiceDid' | 'trendingFeedDid'>,
  params: { feed: string; feedDid: DidString },
): string | undefined {
  const { irisUrl, irisServiceDid, trendingFeedDid } = cfg
  if (!irisUrl || !irisServiceDid || !trendingFeedDid) return
  if (params.feedDid !== irisServiceDid) return
  if (new AtUri(params.feed).host !== trendingFeedDid) return
  return irisUrl
}

export const feedItemFromSkeleton = (
  item: app.bsky.feed.defs.SkeletonFeedPost,
): AlgoResponseItem => ({
  post: { uri: item.post },
  repost:
    item.reason != null &&
    app.bsky.feed.defs.skeletonReasonRepost.$isTypeOf(item.reason)
      ? { uri: item.reason.repost }
      : undefined,
  authorPinned:
    item.reason != null &&
    app.bsky.feed.defs.skeletonReasonPin.$isTypeOf(item.reason)
      ? true
      : undefined,
  feedContext: item.feedContext,
})

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
  resHeaders?: HeadersMap
  cursor?: string
  reqId?: string
}

export type AlgoResponseItem = FeedItem & {
  feedContext?: string
}
