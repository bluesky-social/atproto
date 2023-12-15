import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { getCarStream } from '../getRepo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCheckout({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
        const available = await ctx.accountManager.isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const carStream = await getCarStream(ctx, did)

      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
