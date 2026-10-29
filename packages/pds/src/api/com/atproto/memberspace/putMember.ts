import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, fireNotifyWrite } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.memberspace.putMember, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, did: memberDid, read, write } = body

      assertSpaceOwner(auth, space, { manage: 'update' })

      const commit = await ctx.spacePolicyManager.putMember(space, memberDid, {
        read,
        write,
      })
      await fireNotifyWrite(ctx, { space, writerDid: ownerDid, commit })
    },
  })
}
