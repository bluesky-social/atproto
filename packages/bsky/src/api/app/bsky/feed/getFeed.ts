import { noUndefinedVals } from '@atproto/common'
import {
  XrpcInvalidResponseError,
  XrpcResponseError,
  xrpcSafe,
} from '@atproto/lex-client'
import type { DidString } from '@atproto/lex-schema'
import {
  type Headers as HeadersMap,
  InvalidRequestError,
  type Server,
  ServerTimer,
  UpstreamFailureError,
  XRPCError,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane/index.js'
import { ANALYTICS_HEADER_DEVICE_ID } from '../../../../feature-gates/index.js'
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
import {
  type AlgoResponse,
  type AlgoResponseItem,
  feedItemFromSkeleton,
  filterBlocksAndMutesOnFeed,
  irisStagingUrlForFeed,
  irisUrlForFeed,
  irisUrlForTrendingFeed,
  presentFeedItems,
} from './utils.js'

export default function (server: Server, ctx: AppContext) {
  const getFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.feed.getFeed, {
    auth: ctx.authVerifier.standardReadOptional({
      lxmCheck: (method) => {
        // Cases (only for direct appview access):
        // 1. PDS with custom getFeed handler (like ours): `lxm` is getFeedSkeleton
        //    and `aud` is the feed generator's DID (hence `skipAudCheck`).
        // 2. PDS without custom getFeed handler: `lxm` is getFeed. The feed generator
        //    gets the same token and may reject it.
        //
        // Requests through BSG use hydrateFeedSkeleton instead.
        return (
          method === app.bsky.feed.getFeedSkeleton.$lxm ||
          method === app.bsky.feed.getFeed.$lxm
        )
      },
      skipAudCheck: true,
    }),
    handler: async ({ params, auth, req, signal }) => {
      const viewer = auth.credentials.iss
      const stableDeviceId = req.header(ANALYTICS_HEADER_DEVICE_ID) ?? null
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        xrpcEndpoint: app.bsky.feed.getFeed.$lxm,
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
        {
          ...params,
          hydrateCtx,
          stableDeviceId,
          headers,
          passthroughHeaders,
          signal,
        },
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
  skeleton.items = filterBlocksAndMutesOnFeed(ctx, skeleton.items, hydration)
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  return {
    feed: presentFeedItems(ctx, skeleton.items, hydration, skeleton.reqId),
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
  stableDeviceId: string | null
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

const resolveSkeletonEndpoint = async (
  ctx: Context,
  params: Params,
): Promise<{ endpoint: string; feedDid?: DidString; trusted?: boolean }> => {
  const { feed } = params
  const irisUrl = irisUrlForFeed(ctx.cfg, params)
  if (irisUrl) {
    return {
      endpoint: irisUrl,
      feedDid: await getFeedGenDid(ctx, feed),
      trusted: true,
    }
  }

  const irisStagingUrl = irisStagingUrlForFeed(ctx.cfg, params)
  if (irisStagingUrl) {
    return {
      endpoint: irisStagingUrl,
      feedDid: await getFeedGenDid(ctx, feed),
      trusted: true,
    }
  }

  const feedDid = await getFeedGenDid(ctx, feed)
  if (!feedDid) {
    throw new InvalidRequestError('could not find feed')
  }

  const trendingIrisUrl = irisUrlForTrendingFeed(ctx.cfg, { feed, feedDid })
  if (trendingIrisUrl) {
    return { endpoint: trendingIrisUrl, feedDid, trusted: true }
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

  return { endpoint: fgEndpoint, feedDid, trusted: false }
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
  const { endpoint, feedDid, trusted } = await resolveSkeletonEndpoint(
    ctx,
    params,
  )
  const requestHeaders = noUndefinedVals({
    ...headers,
    ...(feedDid && ctx.cfg.bskyFeedgenDids.has(feedDid)
      ? passthroughHeaders
      : {}),
  })

  // @TODO currently passthrough auth headers from pds
  // Configured endpoints (iris) are ours. The DID-document path is resolved from
  // another account's record, so only that one goes through the guarded fetch.
  const result = await xrpcSafe(
    trusted ? endpoint : { service: endpoint, fetch: ctx.federatedFetch },
    app.bsky.feed.getFeedSkeleton,
    {
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
    },
  )

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
  const feedItems = feedSkele.slice(0, params.limit).map(feedItemFromSkeleton)

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
