import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { noUndefinedVals } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did

      const { data: feed } =
        await ctx.appViewAgent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.appviewAuthHeaders(requester, req),
        )
      const serviceAuthHeaders = await ctx.serviceAuthHeaders(
        requester,
        feed.view.did,
        req,
      )
      const res = await ctx.appViewAgent.api.app.bsky.feed.getFeed(
        params,
        serviceAuthHeaders,
      )

      return {
        encoding: 'application/json',
        body: res.data,
        headers: noUndefinedVals({
          'content-language': res.headers['content-language'],
        }),
      }
    },
  })
}
