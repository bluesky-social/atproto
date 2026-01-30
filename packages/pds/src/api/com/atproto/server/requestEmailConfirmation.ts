import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.requestEmailConfirmation, {
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

      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.requestEmailConfirmation.$lxm,
        )

        await ctx.entrywayClient.xrpc(
          com.atproto.server.requestEmailConfirmation,
          {
            validateResponse: false, // ignore invalid upstream responses
            headers,
          },
        )

        return
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }
      const token = await ctx.accountManager.createEmailToken(
        did,
        'confirm_email',
      )
      await ctx.mailer.sendConfirmEmail({ token }, { to: account.email })
    },
  })
}
