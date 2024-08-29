import assert from 'node:assert'

import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { resultPassthru } from '../../../proxy'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailUpdate({
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
    auth: ctx.authVerifier.accessStandard({ checkTakedown: true }),
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.requestEmailUpdate(
            undefined,
            await ctx.serviceAuthHeaders(
              auth.credentials.did,
              ctx.cfg.entryway.did,
              ids.ComAtprotoServerRequestEmailUpdate,
            ),
          ),
        )
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
        encoding: 'application/json',
        body: {
          tokenRequired,
        },
      }
    },
  })
}
