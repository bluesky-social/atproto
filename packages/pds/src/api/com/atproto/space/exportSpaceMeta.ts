import { byteIterableToStream } from '@atproto/common'
import { serializeSpaceMeta } from '@atproto/space'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.exportSpaceMeta, {
    // OAuth only, as for getSpace: the archive is the authority's own state.
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space } = params

      assertSpaceAuthority(auth, space, { action: 'read_self' })

      const archive = await ctx.spacePolicyManager.exportSpaceMeta(space)
      return {
        encoding: 'application/vnd.dasl.star' as const,
        body: byteIterableToStream(serializeSpaceMeta(archive)),
      }
    },
  })
}
