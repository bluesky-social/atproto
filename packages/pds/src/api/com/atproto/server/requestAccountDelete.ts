import assert from 'node:assert'

import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestAccountDelete({
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
    auth: ctx.authVerifier.accessFull({ checkTakedown: true }),
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
        await ctx.entrywayAgent.com.atproto.server.requestAccountDelete(
          undefined,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoServerRequestAccountDelete,
          ),
        )
        return
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }
      const token = await ctx.accountManager.createEmailToken(
        did,
        'delete_account',
      )
      await ctx.mailer.sendAccountDelete({ token }, { to: account.email })
    },
  })
}
