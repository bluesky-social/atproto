import {
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { getFeedGen } from '@atproto/did-resolver'
import { AtpAgent } from '@atproto/api'
import { SkeletonFeedPost } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const requester = auth.credentials.did

      // Resolve and fetch feed skeleton
      const found = await ctx.db.db
        .selectFrom('feed_generator')
        .where('uri', '=', feed)
        .select('feedDid')
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError('could not find feed')
      }
      const feedDid = found.feedDid
      const resolved = await ctx.didResolver.resolveDid(feedDid)
      if (!resolved) {
        throw new InvalidRequestError(
          `could not resolve did document: ${feedDid}`,
        )
      }
      const fgEndpoint = await getFeedGen(resolved)
      if (!fgEndpoint) {
        throw new InvalidRequestError(`not a valid feed generator: ${feedDid}`)
      }
      const agent = new AtpAgent({ service: fgEndpoint })
      const headers = await createServiceAuthHeaders({
        iss: requester,
        aud: feedDid,
        keypair: ctx.repoSigningKey,
      })
      const { data: skeleton } = await agent.api.app.bsky.feed.getFeedSkeleton(
        params,
        headers,
      )

      // Hydrate feed skeleton
      const { ref } = ctx.db.db.dynamic
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)
      const accountService = ctx.services.account(ctx.db)
      const feedItemUris = skeleton.feed.map(getSkeleFeedItemUri)

      const feedItems = feedItemUris.length
        ? await feedService
            .selectFeedItemQb()
            .where('feed_item.uri', 'in', feedItemUris)
            .whereNotExists(
              // Hide posts and reposts of or by muted actors
              accountService.mutedQb(requester, [
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
            .execute()
        : []

      const hydrated = await feedService.hydrateFeed(
        getOrderedFeedItems(feedItemUris, feedItems),
        requester,
      )

      return {
        encoding: 'application/json',
        body: {
          ...skeleton,
          feed: hydrated,
        },
      }
    },
  })
}

function getSkeleFeedItemUri(item: SkeletonFeedPost) {
  if (typeof item.reason?.repost === 'string') {
    return item.reason.repost
  }
  return item.post
}

function getOrderedFeedItems(uris: string[], feedItems: FeedRow[]) {
  const SKIP = []
  const feedItemsByUri = feedItems.reduce((acc, item) => {
    return Object.assign(acc, { [item.uri]: item })
  }, {} as Record<string, FeedRow[]>)
  return uris.flatMap((uri) => {
    return feedItemsByUri[uri] ?? SKIP
  })
}
