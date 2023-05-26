import { InvalidRequestError } from '@atproto/xrpc-server'
import { getFeedGen } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerator({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const requester = auth.credentials.did

      const feedService = ctx.services.appView.feed(ctx.db)

      const got = await feedService.getFeedGeneratorViews([feed], requester)
      const feedInfo = got[feed]
      if (!feedInfo) {
        throw new InvalidRequestError('could not find feed')
      }

      const feedDid = feedInfo.feedDid
      const resolved = await ctx.idResolver.did.resolve(feedDid)
      if (!resolved) {
        throw new InvalidRequestError(
          `could not resolve did document: ${feedDid}`,
        )
      }
      const fgEndpoint = await getFeedGen(resolved)
      if (!fgEndpoint) {
        throw new InvalidRequestError(`not a valid feed generator: ${feedDid}`)
      }

      let isOnline: boolean
      let isValid: boolean

      if (ctx.algos[feed]) {
        isValid = true
        isOnline = true
      } else {
        const agent = new AtpAgent({ service: fgEndpoint })
        try {
          const res = await agent.api.app.bsky.feed.describeFeedGenerator()
          isOnline = true
          isValid =
            res.data.did === feedDid &&
            res.data.feeds.some((f) => f.uri === feed)
        } catch (err) {
          isOnline = false
          isValid = false
        }
      }

      const profiles = await feedService.getActorViews(
        [feedInfo.creator],
        requester,
      )
      const feedView = feedService.views.formatFeedGeneratorView(
        feedInfo,
        profiles,
      )

      return {
        encoding: 'application/json',
        body: {
          view: feedView,
          isOnline,
          isValid,
        },
      }
    },
  })
}
