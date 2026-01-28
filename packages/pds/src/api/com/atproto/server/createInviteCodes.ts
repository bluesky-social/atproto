import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { genInvCodes } from './util'

type AccountCodes = com.atproto.server.createInviteCodes.AccountCodes

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.createInviteCodes, {
    auth: ctx.authVerifier.adminToken,
    handler: ctx.cfg.entryway
      ? () => {
          throw new InvalidRequestError(
            'Account invites are managed by the entryway service',
          )
        }
      : async ({ input }) => {
          const { codeCount, useCount } = input.body

          const forAccounts = input.body.forAccounts ?? ['admin']

          const accountCodes: AccountCodes[] = []
          for (const account of forAccounts) {
            const codes = genInvCodes(ctx.cfg, codeCount)
            accountCodes.push({ account, codes })
          }
          await ctx.accountManager.createInviteCodes(accountCodes, useCount)

          return {
            encoding: 'application/json' as const,
            body: { codes: accountCodes },
          }
        },
  })
}
