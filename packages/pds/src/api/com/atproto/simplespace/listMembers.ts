import { l } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, toSpaceRef } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.listMembers, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, limit, cursor } = params

      assertSpaceScope(auth, space, { manage: 'update' })

      const { spaceDid } = toSpaceRef(space)
      if (spaceDid !== ownerDid) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      const { spaceRow, members } = await ctx.actorStore.read(
        ownerDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          members: await store.space.listMembers(space, {
            limit: limit ?? 100,
            cursor,
          }),
        }),
      )
      if (!spaceRow || spaceRow.deletedAt) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (!spaceRow.isOwner) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

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
