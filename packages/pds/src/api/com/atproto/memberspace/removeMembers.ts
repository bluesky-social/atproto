import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority, fireNotifyRepoUpdate } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.memberspace.removeMembers, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { space, dids } = body

      assertSpaceAuthority(auth, space, { manage: 'update' })

      const commit = await ctx.spacePolicyManager.removeMembers(space, dids)
      await fireNotifyRepoUpdate(ctx, {
        space,
        writerDid: authorityDid,
        commit,
      })
    },
  })
}
