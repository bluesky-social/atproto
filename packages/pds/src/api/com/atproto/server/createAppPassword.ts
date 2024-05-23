import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAppPassword({
    auth: ctx.authVerifier.accessFull,
    handler: async ({ auth, input, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.createAppPassword(
            input.body,
            authPassthru(req, true),
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
