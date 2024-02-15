import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.requestPlcOperationSignature({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.identity.requestPlcOperationSignature(
          undefined,
          authPassthru(req),
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
