import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { genInvCode } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.createInviteCode, {
    auth: ctx.authVerifier.adminToken,
    handler: ctx.cfg.entryway
      ? () => {
          throw new InvalidRequestError(
            'Account invites are managed by the entryway service',
          )
        }
      : async ({ input }) => {
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
