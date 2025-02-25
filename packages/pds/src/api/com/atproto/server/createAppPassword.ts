import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAppPassword({
    auth: ctx.authVerifier.accessFull({
      checkTakedown: true,
    }),
    handler: async ({ auth, input, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.createAppPassword(
            input.body,
            await ctx.entrywayAuthHeaders(
              req,
              auth.credentials.did,
              ids.ComAtprotoServerCreateAppPassword,
            ),
          ),
        )
      }

      const { name } = input.body
      const appPassword = await ctx.accountManager.createAppPassword(
        auth.credentials.did,
        name,
        input.body.privileged ?? false,
      )

      return {
        encoding: 'application/json',
        body: appPassword,
      }
    },
  })
}
