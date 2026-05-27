import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMembers, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const ownerDid = new SpaceUri(space).spaceDid
      const members = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.listMembers(space, { limit: limit ?? 100, cursor }),
      )

      const last = members.at(-1)
      const nextCursor = last?.did

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: nextCursor,
          members: members.map((m) => ({
            did: m.did as l.DidString,
          })),
        },
      }
    },
  })
}
