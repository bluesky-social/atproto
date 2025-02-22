import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.requestPlcOperationSignature({
    auth: ctx.authVerifier.accessFull({ additional: [AuthScope.Takendown] }),
    handler: async ({ auth }) => {
      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        await ctx.entrywayAgent.com.atproto.identity.requestPlcOperationSignature(
          undefined,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoIdentityRequestPlcOperationSignature,
          ),
        )
        return
      }

      const did = auth.credentials.did
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      } else if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }
      const token = await ctx.accountManager.createEmailToken(
        did,
        'plc_operation',
      )
      await ctx.mailer.sendPlcOperation({ token }, { to: account.email })
    },
  })
}
