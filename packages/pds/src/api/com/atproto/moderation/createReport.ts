import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  authPassthru,
  ensureThisPds,
  proxy,
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

      ensureThisPds(ctx, auth.credentials.pdsDid)

      const requester = auth.credentials.did
      const { data: result } =
        await ctx.appViewAgent.com.atproto.moderation.createReport(input.body, {
          ...(await ctx.serviceAuthHeaders(requester)),
          encoding: 'application/json',
        })
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
