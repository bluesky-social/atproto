import { AppContext } from '../../../../../context'
import { Server } from '../../../../../lexicon'
import { getCarStream } from '../getRepo'
import { assertRepoAvailability } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCheckout({
    auth: ctx.authVerifier.optionalAccessOrAdminToken(),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

      const carStream = await getCarStream(ctx, did)

      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
