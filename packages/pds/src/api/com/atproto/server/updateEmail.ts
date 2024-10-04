import assert from 'node:assert'

import { InvalidRequestError } from '@atproto/xrpc-server'
import disposable from 'disposable-email'

import { UserAlreadyExistsError } from '../../../../account-manager/helpers/account'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.updateEmail({
    auth: ctx.authVerifier.accessFull({ checkTakedown: true }),
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body
      if (!disposable.validate(email)) {
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

      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        await ctx.entrywayAgent.com.atproto.server.updateEmail(
          input.body,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoServerUpdateEmail,
          ),
        )
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
