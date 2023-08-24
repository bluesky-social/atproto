import {
  InvalidRequestError,
  UpstreamFailureError,
  ServerTimer,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import {
  DidDocument,
  PoorlyFormattedDidDocumentError,
  getFeedGen,
} from '@atproto/identity'
import { AtpAgent, AppBskyFeedGetFeedSkeleton } from '@atproto/api'
import { QueryParams as GetFeedParams } from '../../../../lexicon/types/app/bsky/feed/getFeed'
import { OutputSchema as SkeletonOutput } from '../../../../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AlgoResponse } from '../../../../feed-gen/types'
import { Database } from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifierAnyAudience,
    handler: async ({ params, auth, req }) => {
      const { feed } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const localAlgo = ctx.algos[feed]

      const timerSkele = new ServerTimer('skele').start()
      const { feedItems, ...rest } =
        localAlgo !== undefined
          ? await localAlgo(ctx, params, viewer)
          : await skeletonFromFeedGen(
              ctx,
              db,
              params,
              viewer,
              req.headers['authorization'],
            )
      timerSkele.stop()

      const timerHydr = new ServerTimer('hydr').start()
      const hydrated = await feedService.hydrateFeed(feedItems, viewer)
      timerHydr.stop()

      return {
        encoding: 'application/json',
        body: {
          ...rest,
          feed: hydrated,
        },
        headers: {
          'server-timing': serverTimingHeader([timerSkele, timerHydr]),
        },
      }
    },
  })
}

async function skeletonFromFeedGen(
  ctx: AppContext,
  db: Database,
  params: GetFeedParams,
  viewer: string,
  authorization?: string,
): Promise<AlgoResponse> {
  const { feed } = params
  // Resolve and fetch feed skeleton
  const found = await db.db
    .selectFrom('feed_generator')
    .where('uri', '=', feed)
    .select('feedDid')
    .executeTakeFirst()
  if (!found) {
    throw new InvalidRequestError('could not find feed')
  }
  const feedDid = found.feedDid

  let resolved: DidDocument | null
  try {
    resolved = await ctx.idResolver.did.resolve(feedDid)
  } catch (err) {
    if (err instanceof PoorlyFormattedDidDocumentError) {
      throw new InvalidRequestError(`invalid did document: ${feedDid}`)
    }
    throw err
  }
  if (!resolved) {
    throw new InvalidRequestError(`could not resolve did document: ${feedDid}`)
  }

  const fgEndpoint = getFeedGen(resolved)
  if (!fgEndpoint) {
    throw new InvalidRequestError(
      `invalid feed generator service details in did document: ${feedDid}`,
    )
  }

  const agent = new AtpAgent({ service: fgEndpoint })

  let skeleton: SkeletonOutput
  try {
    // @TODO currently passthrough auth headers from pds
    const headers: Record<string, string> = authorization
      ? { authorization }
      : {}
    const result = await agent.api.app.bsky.feed.getFeedSkeleton(params, {
      headers,
    })
    skeleton = result.data
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

  const { feed: skeletonFeed, ...rest } = skeleton
  const cleanedFeed = await ctx.services
    .feed(db)
    .cleanFeedSkeleton(skeletonFeed, params.limit, viewer)

  return {
    ...rest,
    feedItems: cleanedFeed,
  }
}
