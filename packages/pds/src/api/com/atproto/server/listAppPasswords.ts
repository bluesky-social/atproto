import { ForbiddenError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.listAppPasswords({
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.listAppPasswords(
            undefined,
            await ctx.entrywayAuthHeaders(
              req,
              auth.credentials.did,
              ids.ComAtprotoServerListAppPasswords,
            ),
          ),
        )
      }

      const passwords = await ctx.accountManager.listAppPasswords(
        auth.credentials.did,
      )
      return {
        encoding: 'application/json',
        body: { passwords },
      }
    },
  })
}
