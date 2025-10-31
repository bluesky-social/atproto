import { InvalidRequestError } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.requestPlcOperationSignature({
    auth: ctx.authVerifier.authorization({
      // @NOTE Reflect any change in signPlcOperation
      scopes: ACCESS_FULL,
      additional: [AuthScope.Takendown],
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: '*' })
      },
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.identity.requestPlcOperationSignature(
          undefined,
          await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
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
