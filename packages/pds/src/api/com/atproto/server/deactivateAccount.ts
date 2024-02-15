import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deactivateAccount({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input, req }) => {
      await proxy(ctx, auth.credentials.audience, (agent) =>
        agent.api.com.atproto.server.deactivateAccount(
          input.body,
          authPassthru(req, true),
        ),
      )
    },
  })
}
