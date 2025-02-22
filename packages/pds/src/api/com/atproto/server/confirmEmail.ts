import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.confirmEmail({
    auth: ctx.authVerifier.accessStandard({ checkTakedown: true }),
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did

      const user = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
      })
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        await ctx.entrywayAgent.com.atproto.server.confirmEmail(
          input.body,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoServerConfirmEmail,
          ),
        )
        return
      }

      const { token, email } = input.body

      if (user.email !== email.toLowerCase()) {
        throw new InvalidRequestError('invalid email', 'InvalidEmail')
      }
      await ctx.accountManager.confirmEmail({ did, token })
    },
  })
}
