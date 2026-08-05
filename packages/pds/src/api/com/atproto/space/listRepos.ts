import { l } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepos, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params

      assertCredentialSpace(auth.credentials, space)

      const { spaceDid } = toSpaceRef(space)

      // The writer set: accounts that have written to the space, maintained by
      // the authority from incoming notifyWrite calls. This is the sync
      // boundary — it enumerates writers, not readers.
      const { spaceRow, writers } = await ctx.actorStore.read(
        spaceDid,
        async (store) => ({
          spaceRow: await store.space.getSpace(space),
          writers: await store.space.listWriters(space, {
            limit: limit ?? 100,
            cursor,
          }),
        }),
      )
      if (!spaceRow || spaceRow.deletedAt) {
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
