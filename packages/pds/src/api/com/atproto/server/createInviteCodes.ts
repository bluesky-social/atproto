import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'
import { InviteCode } from '../../../../db/tables/invite-code'
import { AccountCodes } from '../../../../lexicon/types/com/atproto/server/createInviteCodes'
import { chunkArray } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCodes({
    auth: ctx.adminVerifier,
    handler: async ({ input, req }) => {
      const { codeCount, useCount } = input.body

      const forAccounts = input.body.forAccounts ?? ['admin']

      const vals: InviteCode[] = []
      const accountCodes: AccountCodes[] = []
      for (const account of forAccounts) {
        const codes = genInvCodes(ctx.cfg, codeCount)
        for (const code of codes) {
          vals.push({
            code: code,
            availableUses: useCount,
            disabled: 0 as const,
            forUser: account,
            createdBy: 'admin',
            createdAt: new Date().toISOString(),
          })
        }
        accountCodes.push({ account, codes })
      }
      await Promise.all(
        chunkArray(vals, 500).map((chunk) =>
          ctx.db.db.insertInto('invite_code').values(chunk).execute(),
        ),
      )

      req.log.info(
        { useCount, codes: accountCodes, forAccounts, codeCount },
        'created invite codes',
      )

      return {
        encoding: 'application/json',
        body: { codes: accountCodes },
      }
    },
  })
}
