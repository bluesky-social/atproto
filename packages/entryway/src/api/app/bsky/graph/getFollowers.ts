import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  proxy,
  proxyAppView,
  resultPassthru,
} from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.accessOrRole,
    handler: async ({ req, params, auth }) => {
      if (auth.credentials.type === 'access') {
        const proxied = await proxy(
          ctx,
          auth.credentials.audience,
          async (agent) => {
            const result = await agent.api.app.bsky.graph.getFollowers(
              params,
              authPassthru(req),
            )
            return resultPassthru(result)
          },
        )
        if (proxied !== null) {
          return proxied
        }
      }

      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      const res = await proxyAppView(ctx, async (agent) =>
        agent.api.app.bsky.graph.getFollowers(
          params,
          requester
            ? await ctx.serviceAuthHeaders(requester)
            : authPassthru(req),
        ),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
