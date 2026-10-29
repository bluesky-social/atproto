import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpace, {
    // OAuth only: the policy is the authority's own state, so a space credential
    // does not reach it. A policy can publish itself to readers instead.
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space } = params

      assertSpaceOwner(auth, space, { action: 'read_self' })

      return {
        encoding: 'application/json' as const,
        body: await ctx.spacePolicyManager.getSpace(space),
      }
    },
  })
}
