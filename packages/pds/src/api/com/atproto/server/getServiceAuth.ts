import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, params, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result = await agent.api.com.atproto.server.getServiceAuth(
            params,
            authPassthru(req),
          )
          return resultPassthru(result)
        },
      )
      if (proxied !== null) {
        return proxied
      }

      throw new InvalidRequestError('Could not locate user PDS')
    },
  })
}
