import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  proxy,
  proxyAppView,
  resultPassthru,
} from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result = await agent.api.app.bsky.feed.getFeed(
            params,
            authPassthru(req),
          )
          return resultPassthru(result)
        },
      )
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did

      const { data: feed } = await proxyAppView(ctx, async (agent) =>
        agent.api.app.bsky.feed.getFeedGenerator(
          { feed: params.feed },
          await ctx.appviewAuthHeaders(requester),
        ),
      )
      const res = await proxyAppView(ctx, async (agent) =>
        agent.api.app.bsky.feed.getFeed(
          params,
          await ctx.serviceAuthHeaders(requester, feed.view.did),
        ),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
