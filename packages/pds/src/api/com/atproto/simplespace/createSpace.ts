import { TID } from '@atproto/common'
import { SpaceRef } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.createSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { type, policy, appAccess } = input.body
      const skey = input.body.skey ?? TID.nextStr()

      const space = new SpaceRef(ownerDid, type, skey).toString()

      assertSpaceScope(auth, space, { manage: 'create' })

      await ctx.simpleSpaceManager.createSpace(space, { policy, appAccess })

      return {
        encoding: 'application/json' as const,
        body: { uri: space },
      }
    },
  })
}
