import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  proxy,
  proxyAppView,
  resultPassthru,
} from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ input, auth, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result = await agent.api.com.atproto.moderation.createReport(
            input.body,
            authPassthru(req, true),
          )
          return resultPassthru(result)
        },
      )
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did
      const { data: result } = await proxyAppView(ctx, async (agent) =>
        agent.com.atproto.moderation.createReport(input.body, {
          ...(await ctx.serviceAuthHeaders(requester)),
          encoding: 'application/json',
        }),
      )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
