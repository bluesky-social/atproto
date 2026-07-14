import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { genInvCode } from './util.js'

export default function (server: Server, ctx: AppContext) {
  const { entryway } = ctx.cfg

  if (entryway) {
    server.add(com.atproto.server.createInviteCode, {
      auth: ctx.authVerifier.adminToken,
      handler: () => {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      },
    })
  } else {
    server.add(com.atproto.server.createInviteCode, {
      auth: ctx.authVerifier.adminToken,
      handler: async ({ input }) => {
        const { useCount, forAccount = 'admin' } = input.body

        const code = genInvCode(ctx.cfg)

        await ctx.accountManager.createInviteCodes(
          [{ account: forAccount, codes: [code] }],
          useCount,
        )

        return {
          encoding: 'application/json' as const,
          body: { code },
        }
      },
    })
  }
}
