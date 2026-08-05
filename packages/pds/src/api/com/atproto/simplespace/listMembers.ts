import { l } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.listMembers, {
    // OAuth only: the member list is the authority's own state, so a space
    // credential does not reach it.
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, limit, cursor } = params

      assertSpaceScope(auth, space, { action: 'read_self' })
      assertSpaceOwner(ownerDid, space)

      const members = await ctx.actorStore.read(ownerDid, async (store) => {
        await store.space.getActiveSpace(space)
        return store.space.listMembers(space, { limit: limit ?? 100, cursor })
      })

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: members.at(-1)?.did,
          members: members.map((m) => ({
            did: m.did as l.DidString,
          })),
        },
      }
    },
  })
}
