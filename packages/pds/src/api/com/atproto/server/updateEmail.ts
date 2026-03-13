import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import {
  ForbiddenError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { UserAlreadyExistsError } from '../../../../account-manager/helpers/account'
import { ACCESS_FULL } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.updateEmail, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: async ({ auth, input: { body }, req }) => {
      const did = auth.credentials.did
      const { token, email } = body
      if (!isEmailValid(email) || isDisposableEmail(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.updateEmail.$lxm,
        )

        await ctx.entrywayClient.xrpc(com.atproto.server.updateEmail, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
          body,
        })

        return
      }

      // require valid token if account email is confirmed
      if (account.emailConfirmedAt) {
        if (!token) {
          throw new InvalidRequestError(
            'confirmation token required',
            'TokenRequired',
          )
        }
        await ctx.accountManager.assertValidEmailToken(
          did,
          'update_email',
          token,
        )
      }

      try {
        await ctx.accountManager.updateEmail({ did, email })
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(
            'This email address is already in use, please use a different email.',
          )
        } else {
          throw err
        }
      }
    },
  })
}
