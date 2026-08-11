import { mapDefined, noUndefinedVals } from '@atproto/common'
import {
  XrpcInvalidResponseError,
  XrpcResponseError,
  xrpcSafe,
} from '@atproto/lex'
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
    handler: async ({ params, auth, req }) => {
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
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })
      // @NOTE feed cursors should not be affected by appview swap
      // Do not refill filtered pages. Overfetching from algorithmic feeds can
      // advance their state and prevent omitted items from appearing later.
      const result = await getFeed({ ...params, hydrateCtx, headers }, ctx)
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
  if (
    !params.hydrateCtx.features.checkGate(
      params.hydrateCtx.features.Gate.IrisFeed,
    )
  ) {
    return
  }
  return irisUrl
}

const resolveSkeletonEndpoint = async (
  ctx: Context,
  params: Params,
): Promise<string> => {
  const irisUrl = irisUrlForFeed(ctx.cfg, params)
  if (irisUrl) return irisUrl

  const { feed } = params
  const found = await ctx.hydrator.feed.getFeedGens([feed], true)
  const feedDid = found.get(feed)?.record.did
  if (!feedDid) {
    throw new InvalidRequestError('could not find feed')
  }

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

  return fgEndpoint
}

const skeletonFromFeedGen = async (
  ctx: Context,
  params: Params,
): Promise<AlgoResponse> => {
  const { headers } = params
  const endpoint = await resolveSkeletonEndpoint(ctx, params)

  // @TODO currently passthrough auth headers from pds
  const result = await xrpcSafe(endpoint, app.bsky.feed.getFeedSkeleton, {
    strictResponseProcessing: false,
    signal: AbortSignal.timeout(10_000),
    headers,
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
