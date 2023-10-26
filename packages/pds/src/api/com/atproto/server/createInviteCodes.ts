import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'
import { AccountCodes } from '../../../../lexicon/types/com/atproto/server/createInviteCodes'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCodes({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { codeCount, useCount } = input.body

      const forAccounts = input.body.forAccounts ?? ['admin']

      const accountCodes: AccountCodes[] = []
      for (const account of forAccounts) {
        const codes = genInvCodes(ctx.cfg, codeCount)
        accountCodes.push({ account, codes })
      }
      await ctx.accountManager.createInviteCodes(accountCodes, useCount)

      return {
        encoding: 'application/json',
        body: { codes: accountCodes },
      }
    },
  })
}
