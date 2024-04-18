import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchAccounts({
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      try {
        const accounts = await ctx.accountManager.searchAccounts({
          ...params,
          includeDeactivated: true,
          includeTakenDown: true,
        })

        return {
          encoding: 'application/json',
          body: {
            accounts: accounts.map(({ did, handle }) => ({
              did,
              handle: handle || '',
              // TODO: Temporary
              indexedAt: new Date().toISOString(),
            })),
            cursor: '',
          },
        }
      } catch (e) {
        console.error(e)
        throw e
      }
    },
  })
}
