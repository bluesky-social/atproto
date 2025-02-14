import { AppBskyFeedGetFeedSkeleton, AtpAgent } from '@atproto/api'
import { mapDefined, noUndefinedVals } from '@atproto/common'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import {
  InvalidRequestError,
  ServerTimer,
  UpstreamFailureError,
  serverTimingHeader,
} from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane/index'
import { FeedItem } from '../../../../hydration/feed'
import { HydrateCtx } from '../../../../hydration/hydrate-ctx'
import { Server } from '../../../../lexicon/index'
import { ids } from '../../../../lexicon/lexicons'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/feed/getFeed'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  items: AlgoResponseItem[]
  passthrough: Record<string, unknown> // pass through additional items in feedgen response
  resHeaders?: Record<string, string>
  cursor?: string
  timerSkele: ServerTimer
  timerHydr: ServerTimer
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        return (
          method !== undefined &&
          [ids.AppBskyFeedGetFeedSkeleton, ids.AppBskyFeedGetFeed].includes(
            method,
          )
        )
      },
      skipAudCheck: true,
    }),
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocksOrMutes,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  const timerSkele = new ServerTimer('skele').start()
  const {
    feedItems: algoItems,
    cursor,
    resHeaders,
    ...passthrough
  } = await skeletonFromFeedGen(ctx)

  return {
    cursor,
    items: algoItems,
    timerSkele: timerSkele.stop(),
    timerHydr: new ServerTimer('hydr').start(),
    resHeaders,
    passthrough,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  const timerHydr = new ServerTimer('hydr').start()
  const hydration = await ctx.hydrator.hydrateFeedItems(skeleton.items, ctx)
  skeleton.timerHydr = timerHydr.stop()
  return hydration
}

const noBlocksOrMutes: RulesFn<Skeleton, QueryParams> = (
  ctx,
  skeleton,
  hydration,
) => {
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

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const feed = mapDefined(skeleton.items, (item) => {
    const post = ctx.views.feedViewPost(item, hydration)
    if (!post) return
    return {
      ...post,
      feedContext: item.feedContext,
    }
  })
  return {
    headers: {
      ...skeleton.resHeaders,
      'server-timing': serverTimingHeader([
        skeleton.timerSkele,
        skeleton.timerHydr,
      ]),
    },
    body: {
      feed,
      // @NOTE feed cursors should not be affected by appview swap
      cursor: skeleton.cursor,
      ...skeleton.passthrough,
    },
  }
}

async function skeletonFromFeedGen(
  ctx: HydrateCtx<QueryParams>,
): Promise<AlgoResponse> {
  const { feed, limit, cursor } = ctx.params

  const found = await ctx.hydrator.feed.getFeedGens([feed], true)
  const feedDid = await found.get(feed)?.record.did
  if (!feedDid) {
    throw new InvalidRequestError('could not find feed')
  }

  const identity = await ctx.dataplane
    .getIdentityByDid({ did: feedDid })
    .catch((err) => {
      if (isDataplaneError(err, Code.NotFound)) {
        throw new InvalidRequestError(`could not resolve identity: ${feedDid}`)
      }
      throw err
    })

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

  const agent = new AtpAgent({ service: fgEndpoint })

  let skeleton: AppBskyFeedGetFeedSkeleton.OutputSchema
  let resHeaders: Record<string, string> | undefined = undefined
  try {
    const headers = noUndefinedVals({
      // @TODO currently passthrough auth headers from pds
      authorization: ctx.headers['authorization'],
      'accept-language': ctx.headers['accept-language'],
      'x-bsky-topics': Array.isArray(ctx.headers['x-bsky-topics'])
        ? ctx.headers['x-bsky-topics'].join(',')
        : ctx.headers['x-bsky-topics'],
    })

    const result = await agent.app.bsky.feed.getFeedSkeleton(
      {
        feed,
        // The feedgen is not guaranteed to honor the limit, but we try it.
        limit,
        cursor,
      },
      { headers },
    )
    skeleton = result.data
    if (result.headers['content-language']) {
      resHeaders = {
        'content-language': result.headers['content-language'],
      }
    }
  } catch (err) {
    if (err instanceof AppBskyFeedGetFeedSkeleton.UnknownFeedError) {
      throw new InvalidRequestError(err.message, 'UnknownFeed')
    }
    if (err instanceof XRPCError) {
      if (err.status === ResponseType.Unknown) {
        throw new UpstreamFailureError('feed unavailable')
      }
      if (err.status === ResponseType.InvalidResponse) {
        throw new UpstreamFailureError(
          'feed provided an invalid response',
          'InvalidFeedResponse',
        )
      }
    }
    throw err
  }

  const { feed: feedSkele, ...skele } = skeleton
  const feedItems = feedSkele.slice(0, limit).map((item) => ({
    post: { uri: item.post },
    repost:
      typeof item.reason?.repost === 'string'
        ? { uri: item.reason.repost }
        : undefined,
    feedContext: item.feedContext,
  }))

  return { ...skele, resHeaders, feedItems }
}

export type AlgoResponse = {
  feedItems: AlgoResponseItem[]
  resHeaders?: Record<string, string>
  cursor?: string
}

export type AlgoResponseItem = FeedItem & {
  feedContext?: string
}
