import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  proxy,
  proxyAppView,
  resultPassthru,
} from '../../../proxy'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTaggedSuggestions({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result =
            await agent.api.app.bsky.unspecced.getTaggedSuggestions(
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
      const res = await proxyAppView(ctx, async (agent) =>
        agent.api.app.bsky.unspecced.getTaggedSuggestions(
          params,
          await ctx.appviewAuthHeaders(requester),
        ),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
