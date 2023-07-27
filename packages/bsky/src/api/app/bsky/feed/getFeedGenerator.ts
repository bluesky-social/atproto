import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  DidDocument,
  PoorlyFormattedDidDocumentError,
  getFeedGen,
} from '@atproto/identity'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerator({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const viewer = auth.credentials.did

      const feedService = ctx.services.feed(ctx.db)

      const got = await feedService.getFeedGeneratorInfos([feed], viewer)
      const feedInfo = got[feed]
      if (!feedInfo) {
        throw new InvalidRequestError('could not find feed')
      }

      const feedDid = feedInfo.feedDid
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
        throw new InvalidRequestError(
          `could not resolve did document: ${feedDid}`,
        )
      }

      const fgEndpoint = getFeedGen(resolved)
      if (!fgEndpoint) {
        throw new InvalidRequestError(
          `invalid feed generator service details in did document: ${feedDid}`,
        )
      }

      const profiles = await feedService.getActorInfos(
        [feedInfo.creator],
        viewer,
      )
      const feedView = feedService.views.formatFeedGeneratorView(
        feedInfo,
        profiles,
      )

      return {
        encoding: 'application/json',
        body: {
          view: feedView,
          // @TODO temporarily hard-coding to true while external feedgens catch-up on describeFeedGenerator
          isOnline: true,
          isValid: true,
        },
      }
    },
  })
}
