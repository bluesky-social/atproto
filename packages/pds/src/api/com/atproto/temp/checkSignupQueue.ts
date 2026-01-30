import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.temp.checkSignupQueue, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.SignupQueued],
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: async ({ req }) => {
      if (!ctx.entrywayClient) {
        return {
          encoding: 'application/json' as const,
          body: {
            activated: true,
          },
        }
      }

      const { headers } = ctx.entrywayPassthruHeaders(req)

      return ctx.entrywayClient.xrpc(com.atproto.temp.checkSignupQueue, {
        validateResponse: false, // ignore invalid upstream responses
        headers,
      })
    },
  })
}
