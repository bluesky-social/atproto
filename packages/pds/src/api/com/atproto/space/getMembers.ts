import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getMembers, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space } = params

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
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
