import { byteIterableToStream } from '@atproto/common'
import { writeSpaceMetaStar } from '@atproto/space'
import type { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.exportSpaceMeta, {
    // OAuth only, as for getSpace: the archive is the authority's own state.
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const ref = toSpaceRef(params.space)

      assertSpaceAuthority(auth, ref, { action: 'read_self' })

      const archive = await ctx.spacePolicyManager.exportSpaceMeta(ref)
      return {
        encoding: 'application/vnd.dasl.star',
        body: byteIterableToStream(writeSpaceMetaStar(archive)),
      }
    },
  })
}
