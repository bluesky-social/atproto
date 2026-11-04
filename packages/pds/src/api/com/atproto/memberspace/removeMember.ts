import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority, fireNotifyWrite } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.memberspace.removeMember, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const spaceAuthority = auth.credentials.did
      const { space, did: memberDid } = body

      assertSpaceAuthority(auth, space, { manage: 'update' })

      const commit = await ctx.spacePolicyManager.removeMember(space, memberDid)
      await fireNotifyWrite(ctx, { space, writerDid: spaceAuthority, commit })
    },
  })
}
