import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, resultPassthru } from '../../../proxy'
import { AuthScope } from '../../../../auth-verifier'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.checkSignupQueue({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.SignupQueued],
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
          authPassthru(req),
        ),
      )
    },
  })
}
