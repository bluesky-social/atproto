import { Server } from '@atproto/xrpc-server'
import { isUserOrAdmin } from '../../../../../auth-verifier'
import { AppContext } from '../../../../../context'
import { getCarStream } from '../getRepo'
import { assertRepoAvailability } from '../util'
import { com } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getCheckout, {
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
        encoding: 'application/vnd.ipld.car' as const,
        body: carStream,
      }
    },
  })
}
