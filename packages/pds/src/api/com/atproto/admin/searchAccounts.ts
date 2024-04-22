import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchAccounts({
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      const { accounts, cursor } = await ctx.accountManager.searchAccounts({
        ...params,
      })

      return {
        encoding: 'application/json',
        body: {
          accounts: accounts.map(({ did, handle, email, normalizedEmail }) => ({
            did,
            email,
            handle: handle ?? undefined,
            normalizedEmail: normalizedEmail ?? undefined,
          })),
          cursor,
        },
      }
    },
  })
}
