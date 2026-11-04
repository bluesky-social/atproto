import { TID } from '@atproto/common'
import { SpaceRef } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { fireNotifyRepoUpdate } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createSpace, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { spaceType, policy, skey = TID.nextStr() } = body

      const ref = new SpaceRef(authorityDid, spaceType, skey)
      const space = ref.toString()

      auth.credentials.permissions?.assertSpace(ref, {
        manage: 'create',
      })

      const commit = await ctx.spacePolicyManager.createSpace(space, policy)
      await fireNotifyRepoUpdate(ctx, {
        space,
        writerDid: authorityDid,
        commit,
      })

      return {
        encoding: 'application/json' as const,
        body: { space },
      }
    },
  })
}
