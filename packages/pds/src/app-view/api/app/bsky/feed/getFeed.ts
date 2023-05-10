import {
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { getFeedGen } from '@atproto/did-resolver'
import { AtpAgent } from '@atproto/api'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const requester = auth.credentials.did

      const found = await ctx.db.db
        .selectFrom('feed_generator')
        .where('uri', '=', feed)
        .select('feedDid')
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError('could not resolve find feed')
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
      const res = await agent.api.app.bsky.feed.getFeedSkeleton(params, headers)
      const feedService = ctx.services.appView.feed(ctx.db)
      const hydrated = await feedService.hydrateFeed(res.data.feed, requester)

      return {
        encoding: 'application/json',
        body: {
          feed: hydrated,
          cursor: res.data.cursor,
        },
      }
    },
  })
}
