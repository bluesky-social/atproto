import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result =
            await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
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
      const res =
        await ctx.appViewAgent.api.app.bsky.unspecced.getPopularFeedGenerators(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
