import { l } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepos, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
      }

      const authorityDid = new SpaceUri(space).spaceDid

      // @TODO This should enumerate the writer set (accounts that have written
      // to the space), which the authority maintains from notifyWrite. There's
      // no writer-set table yet, so we return the simplespace member list as a
      // stand-in (in simplespace, members are the expected writers). See
      // SPACE_RECONCILIATION_NOTES.md.
      const { spaceRow, members } = await ctx.actorStore.read(
        authorityDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          members: await store.space.listMembers(space, {
            limit: limit ?? 100,
            cursor,
          }),
        }),
      )
      if (!spaceRow || spaceRow.deletedAt || !spaceRow.isOwner) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: members.at(-1)?.did,
          repos: members.map((m) => ({
            did: m.did as l.DidString,
          })),
        },
      }
    },
  })
}
