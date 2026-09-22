import { TID } from '@atproto/common'
import { SpaceRef } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.createSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const ownerDid = auth.credentials.did
      const {
        type,
        readPolicy,
        writePolicy,
        appAccess,
        skey = TID.nextStr(),
      } = body

      const ref = new SpaceRef(ownerDid, type, skey)
      const uri = ref.toString()

      auth.credentials.permissions?.assertSpaceRef(ref, {
        manage: 'create',
      })

      await ctx.simpleSpaceManager.createSpace(uri, {
        readPolicy,
        writePolicy,
        appAccess,
      })

      return {
        encoding: 'application/json' as const,
        body: { uri },
      }
    },
  })
}
