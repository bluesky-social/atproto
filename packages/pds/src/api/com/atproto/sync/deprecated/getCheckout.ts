import { isUserOrAdmin } from '../../../../../auth-verifier'
import { AppContext } from '../../../../../context'
import { Server } from '../../../../../lexicon'
import { getCarStream } from '../getRepo'
import { assertRepoAvailability } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCheckout({
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const carStream = await getCarStream(ctx, did)

      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
