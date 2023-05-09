import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { getFeedGen } from '@atproto/did-resolver'
import { AtpAgent } from '@atproto/api'
import { createServiceAuthHeaders } from '../../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const db = ctx.db.db
      const requester = auth.credentials.did

      let feedDid: string
      if (feed.startsWith('did:')) {
        feedDid = feed
      } else {
        const found = await db
          .selectFrom('did_handle')
          .where('handle', '=', feed)
          .select('did')
          .executeTakeFirst()
        if (!found) {
          throw new InvalidRequestError(
            `could not resolve feed handle: ${feed}`,
          )
        }
        feedDid = found.did
      }
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
      const headers = await createServiceAuthHeaders(
        requester,
        ctx.repoSigningKey,
      )
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
