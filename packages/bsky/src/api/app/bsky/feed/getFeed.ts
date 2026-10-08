import { mapDefined, noUndefinedVals } from '@atproto/common'
import {
  type DidString,
  XrpcInvalidResponseError,
  XrpcResponseError,
  xrpcSafe,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  type Headers as HeadersMap,
  InvalidRequestError,
  type Server,
  ServerTimer,
  UpstreamFailureError,
  XRPCError,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane/index.js'
import { Gate } from '../../../../feature-gates/gates.js'
import type { FeedItem } from '../../../../hydration/feed.js'
import type { HydrateCtx } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type RulesFnInput,
  type SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import type { GetIdentityByDidResponse } from '../../../../proto/bsky_pb.js'
import { getAtprotoPassthroughHeaders } from '../../../../util/headers.js'
import { BSKY_USER_AGENT, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.feed.getFeed, {
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        return (
          method === app.bsky.feed.getFeedSkeleton.$lxm ||
          method === app.bsky.feed.getFeed.$lxm
        )
      },
      skipAudCheck: true,
    }),
    handler: async ({ params, auth, req, signal }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
        ),
      })
      const headers = noUndefinedVals({
        'user-agent': BSKY_USER_AGENT,
        authorization: req.headers['authorization'],
        'accept-language': req.headers['accept-language'],
      })
      const passthroughHeaders = getAtprotoPassthroughHeaders(req)
      // @NOTE feed cursors should not be affected by appview swap
      // Do not refill filtered pages. Overfetching from algorithmic feeds can
      // advance their state and prevent omitted items from appearing later.
      const result = await getFeed(
        { ...params, hydrateCtx, headers, passthroughHeaders, signal },
        ctx,
      )
      const {
        timerSkele,
        timerHydr,
        resHeaders: feedResHeaders,
        ...body
      } = result

      return {
        encoding: 'application/json',
        body,
        headers: {
          ...feedResHeaders,
          ...resHeaders({ labelers: hydrateCtx.labelers }),
          'server-timing': serverTimingHeader([timerSkele, timerHydr]),
        },
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const timerSkele = new ServerTimer('skele').start()
  const {
    feedItems: algoItems,
    reqId,
    cursor,
    resHeaders,
    ...passthrough
  } = await skeletonFromFeedGen(ctx, params)

  return {
    cursor,
    items: algoItems,
    reqId,
    timerSkele: timerSkele.stop(),
    timerHydr: new ServerTimer('hydr').start(),
    resHeaders,
    passthrough,
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  const timerHydr = new ServerTimer('hydr').start()
  const hydration = await ctx.hydrator.hydrateFeedItems(
    skeleton.items,
    params.hydrateCtx,
    {
      knownLikers:
        !!params.hydrateCtx.viewer &&
        params.hydrateCtx.features.checkGate(
          params.hydrateCtx.features.Gate.KnownLikersFeedEnable,
        ),
    },
  )
  skeleton.timerHydr = timerHydr.stop()
  return hydration
}

const noBlocksOrMutes = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.items = skeleton.items.filter((item) => {
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

  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const feed = mapDefined(skeleton.items, (item) => {
    const post = ctx.views.feedViewPost(item, hydration)
    if (!post) return
    return {
      ...post,
      feedContext: item.feedContext,
    }
  })
  return {
    feed: feed.map((fi) => ({ ...fi, reqId: skeleton.reqId })),
    cursor: skeleton.cursor,
    timerSkele: skeleton.timerSkele,
    timerHydr: skeleton.timerHydr,
    resHeaders: skeleton.resHeaders,
    ...skeleton.passthrough,
  }
}

type Context = AppContext

type Params = app.bsky.feed.getFeed.$Params & {
  hydrateCtx: HydrateCtx
  headers: HeadersMap
  passthroughHeaders: HeadersMap
  signal: AbortSignal
}

type Skeleton = {
  items: AlgoResponseItem[]
  reqId?: string
  passthrough: Record<string, unknown> // pass through additional items in feedgen response
  resHeaders?: HeadersMap
  cursor?: string
  timerSkele: ServerTimer
  timerHydr: ServerTimer
}

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
 */
export const irisUrlForFeed = (
  cfg: Pick<ServerConfig, 'irisUrl' | 'irisFeedUris'>,
  params: {
    feed: string
    hydrateCtx: {
      viewer: HydrateCtx['viewer']
      features: Pick<HydrateCtx['features'], 'Gate' | 'checkGate'>
    }
  },
): string | undefined => {
  const { irisUrl } = cfg
  if (!irisUrl) return
  if (!cfg.irisFeedUris?.has(params.feed)) return
  if (!params.hydrateCtx.viewer) return
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

const resolveSkeletonEndpoint = async (
  ctx: Context,
  params: Params,
): Promise<{ endpoint: string; feedDid?: DidString }> => {
  const { feed } = params
  const irisUrl = irisUrlForFeed(ctx.cfg, params)
  if (irisUrl) {
    return { endpoint: irisUrl, feedDid: await getFeedGenDid(ctx, feed) }
  }

  const irisStagingUrl = irisStagingUrlForFeed(ctx.cfg, params)
  if (irisStagingUrl) {
    return {
      endpoint: irisStagingUrl,
      feedDid: await getFeedGenDid(ctx, feed),
    }
  }

  const feedDid = await getFeedGenDid(ctx, feed)
  if (!feedDid) {
    throw new InvalidRequestError('could not find feed')
  }

  const trendingIrisUrl = irisUrlForTrendingFeed(ctx.cfg, { feed, feedDid })
  if (trendingIrisUrl) return { endpoint: trendingIrisUrl, feedDid }

  let identity: GetIdentityByDidResponse
  try {
    identity = await ctx.dataplane.getIdentityByDid({ did: feedDid })
  } catch (err) {
    if (isDataplaneError(err, Code.NotFound)) {
      throw new InvalidRequestError(`could not resolve identity: ${feedDid}`)
    }
    throw err
  }

  const services = unpackIdentityServices(identity.services)
  const fgEndpoint = getServiceEndpoint(services, {
    id: 'bsky_fg',
    type: 'BskyFeedGenerator',
  })
  if (!fgEndpoint) {
    throw new InvalidRequestError(
      `invalid feed generator service details in did document: ${feedDid}`,
    )
  }

  return { endpoint: fgEndpoint, feedDid }
}

async function getFeedGenDid(
  ctx: Context,
  feed: Params['feed'],
): Promise<DidString | undefined> {
  const found = await ctx.hydrator.feed.getFeedGens([feed], true)
  return found.get(feed)?.record.did
}

const skeletonFromFeedGen = async (
  ctx: Context,
  params: Params,
): Promise<AlgoResponse> => {
  const { headers, passthroughHeaders } = params
  const { endpoint, feedDid } = await resolveSkeletonEndpoint(ctx, params)
  const requestHeaders = noUndefinedVals({
    ...headers,
    ...(feedDid && ctx.cfg.bskyFeedgenDids.has(feedDid)
      ? passthroughHeaders
      : {}),
  })

  // @TODO currently passthrough auth headers from pds
  const result = await xrpcSafe(endpoint, app.bsky.feed.getFeedSkeleton, {
    strictResponseProcessing: false,
    signal: AbortSignal.any([
      params.signal,
      AbortSignal.timeout(ctx.cfg.feedGenSkeletonTimeout),
    ]),
    headers: requestHeaders,
    params: {
      feed: params.feed,
      // The feedgen is not guaranteed to honor the limit, but we try it.
      limit: params.limit,
      cursor: params.cursor,
    },
  })

  if (!result.success) {
    const cause = result.reason

    // Pass through structurally valid XRPC error response (4xx/5xx), such as
    // auth errors
    if (cause instanceof XrpcResponseError) {
      const { status, body } = cause.toDownstreamError()
      throw new XRPCError(status, body.message, body.error, { cause })
    }

    // The response does not match the schema
    if (cause instanceof XrpcInvalidResponseError) {
      throw new UpstreamFailureError(
        'feed provided an invalid response',
        'InvalidFeedResponse',
        { cause },
      )
    }

    // Typically a network error.
    throw new UpstreamFailureError('feed unavailable', undefined, { cause })
  }

  const { feed: feedSkele, cursor, ...skele } = result.body
  const feedItems = feedSkele.slice(0, params.limit).map((item) => ({
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
  }))

  const contentLang = result.headers.get('content-language')

  return {
    ...skele,
    resHeaders: contentLang ? { 'content-language': contentLang } : undefined,
    feedItems,
    // An empty feed-generator page ends pagination even if it includes a cursor.
    // Also prevent loops if the custom feed echoes the input cursor back.
    cursor:
      feedSkele.length === 0 || cursor === params.cursor ? undefined : cursor,
  }
}

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
  resHeaders?: HeadersMap
  cursor?: string
  reqId?: string
}

export type AlgoResponseItem = FeedItem & {
  feedContext?: string
}
