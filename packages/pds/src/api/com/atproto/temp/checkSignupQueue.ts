import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { resultPassthru } from '../../../proxy'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.checkSignupQueue({
    auth: ctx.authVerifier.accessStandard({
      extraScopes: [AuthScope.SignupQueued],
    }),
    handler: async ({ req }) => {
      if (!ctx.entrywayAgent) {
        return {
          encoding: 'application/json',
          body: {
            activated: true,
          },
        }
      }
      return resultPassthru(
        await ctx.entrywayAgent.com.atproto.temp.checkSignupQueue(
          undefined,
          ctx.entrywayPassthruHeaders(req),
        ),
      )
    },
  })
}
