import { TID } from '@atproto/common'
import { SpaceRef } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const ownerDid = auth.credentials.did
      const { spaceType, policy, skey = TID.nextStr() } = body

      const ref = new SpaceRef(ownerDid, spaceType, skey)
      const uri = ref.toString()

      auth.credentials.permissions?.assertSpaceRef(ref, {
        manage: 'create',
      })

      const commit = await ctx.spacePolicyManager.createSpace(uri, policy)
      await fireNotifyWrite(ctx, { space: uri, writerDid: ownerDid, commit })

      return {
        encoding: 'application/json' as const,
        body: { uri },
      }
    },
  })
}
