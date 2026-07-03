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

      const authorityDid = new SpaceUri(space).authorityDid

      // The writer set: accounts that have written to the space, maintained by
      // the authority from incoming notifyWrite calls. This is the sync
      // boundary — it enumerates writers, not readers.
      const { spaceRow, writers } = await ctx.actorStore.read(
        authorityDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          writers: await store.space.listWriters(space, {
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
          cursor: writers.at(-1)?.did,
          repos: writers.map((w) => ({
            did: w.did as l.DidString,
            rev: w.rev,
            hash: w.hash,
          })),
        },
      }
    },
  })
}
