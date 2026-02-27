import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.requestEmailUpdate, {
    rateLimit: [
      {
        durationMs: DAY,
        points: 15,
        calcKey: ({ auth }) => auth.credentials.did,
      },
      {
        durationMs: HOUR,
        points: 5,
        calcKey: ({ auth }) => auth.credentials.did,
      },
    ],
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'email', action: 'manage' })
      },
    }),
    handler: async ({ auth, req }) => {
      const did = auth.credentials.did
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.requestEmailUpdate.$lxm,
        )
        return entrywayClient.xrpc(com.atproto.server.requestEmailUpdate, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
        })
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }

      const tokenRequired = !!account.emailConfirmedAt
      if (tokenRequired) {
        const token = await ctx.accountManager.createEmailToken(
          did,
          'update_email',
        )
        await ctx.mailer.sendUpdateEmail({ token }, { to: account.email })
      }

      return {
        encoding: 'application/json' as const,
        body: {
          tokenRequired,
        },
      }
    },
  })
}
