import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    // @NOTE Reflect any change in signPlcOperation
    scopes: ACCESS_FULL,
    additional: [AuthScope.Takendown],
    authorize: (permissions) => {
      permissions.assertIdentity({ attr: '*' })
    },
  })

  if (entrywayClient) {
    // @TODO we should have a higher level way of defining these "passthrough"
    // handlers
    server.add(com.atproto.identity.requestPlcOperationSignature, {
      auth,
      handler: async ({ auth, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.identity.requestPlcOperationSignature.$lxm,
        )
        await entrywayClient.xrpc(
          com.atproto.identity.requestPlcOperationSignature,
          { headers },
        )
      },
    })
  } else {
    server.add(com.atproto.identity.requestPlcOperationSignature, {
      auth,
      handler: async ({ auth }) => {
        const did = auth.credentials.did
        const account = await ctx.accountManager.getAccount(did, {
          includeDeactivated: true,
          includeTakenDown: true,
        })
        if (!account) {
          throw new InvalidRequestError('account not found')
        } else if (!account.email) {
          throw new InvalidRequestError(
            'account does not have an email address',
          )
        }
        const token = await ctx.accountManager.createEmailToken(
          did,
          'plc_operation',
        )
        await ctx.mailer.sendPlcOperation({ token }, { to: account.email })
      },
    })
  }
}
