import type { l } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner } from '../space/util.js'

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

      assertSpaceOwner(auth, space, { action: 'read_self' })

      const members = await ctx.actorStore.read(ownerDid, async (store) => {
        await store.space.getActiveSpaceConfig(space)
        return store.space.listMembers(space, { limit, cursor })
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: members.at(-1)?.did,
          members: members.map((member) => ({
            did: member.did as l.DidString,
            read: !!member.read,
            write: !!member.write,
          })),
        },
      }
    },
  })
}
