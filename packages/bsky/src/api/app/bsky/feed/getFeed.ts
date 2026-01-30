import { mapDefined, noUndefinedVals } from '@atproto/common'
import { Client } from '@atproto/lex'
import {
  Headers as HeadersMap,
  InvalidRequestError,
  Server,
  ServerTimer,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane'
import { FeedItem } from '../../../../hydration/feed'
import { HydrateCtx } from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { GetIdentityByDidResponse } from '../../../../proto/bsky_pb'
import { BSKY_USER_AGENT, resHeaders } from '../../../util'

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
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const headers = noUndefinedVals({
        'user-agent': BSKY_USER_AGENT,
        authorization: req.headers['authorization'],
        'accept-language': req.headers['accept-language'],
        'x-bsky-topics': Array.isArray(req.headers['x-bsky-topics'])
          ? req.headers['x-bsky-topics'].join(',')
          : req.headers['x-bsky-topics'],
      })
      // @NOTE feed cursors should not be affected by appview swap
      const {
        timerSkele,
        timerHydr,
        resHeaders: feedResHeaders,
        ...result
      } = await getFeed({ ...params, hydrateCtx, headers }, ctx)

      return {
        encoding: 'application/json',
        body: result,
        headers: {
          ...(feedResHeaders ?? {}),
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
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
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

type Params = app.bsky.feed.getFeed.Params & {
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

const skeletonFromFeedGen = async (
  ctx: Context,
  params: Params,
): Promise<AlgoResponse> => {
  const { feed, headers } = params
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

  const client = new Client({ service: fgEndpoint })

  const resHeaders: HeadersMap = {}

  // @TODO currently passthrough auth headers from pds
  const result = await client.xrpc(app.bsky.feed.getFeedSkeleton, {
    headers,
    params: {
      feed: params.feed,
      // The feedgen is not guaranteed to honor the limit, but we try it.
      limit: params.limit,
      cursor: params.cursor,
    },
  })

  const skeleton: app.bsky.feed.getFeedSkeleton.OutputBody = result.body

  if (result.body.cursor === params.cursor) {
    // Prevents loops if the custom feed echoes the input cursor back.
    skeleton.cursor = undefined
  }

  const contentLang = result.headers.get('content-language')
  if (contentLang) resHeaders['content-language'] = contentLang

  const { feed: feedSkele, ...skele } = skeleton
  const feedItems = feedSkele.slice(0, params.limit).map((item) => ({
    post: { uri: item.post },
    repost: app.bsky.feed.defs.skeletonReasonRepost.$matches(item.reason)
      ? { uri: item.reason.repost }
      : undefined,
    feedContext: item.feedContext,
  }))

  return { ...skele, resHeaders, feedItems }
}

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
  resHeaders: HeadersMap
  cursor?: string
  reqId?: string
}

export type AlgoResponseItem = FeedItem & {
  feedContext?: string
}
