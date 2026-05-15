import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMembers, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const ownerDid = new SpaceUri(space).spaceDid
      const members = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.listMembers(space),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          members: members.map((m) => ({
            did: m.did as l.DidString,
            addedAt: m.addedAt as l.DatetimeString,
          })),
        },
      }
    },
  })
}
