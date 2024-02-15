import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, req }) => {
      await proxy(ctx, auth.credentials.audience, (agent) =>
        agent.api.com.atproto.server.activateAccount(
          undefined,
          authPassthru(req, true),
        ),
      )
    },
  })
}
