import { l } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, assertSpaceHost } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepos, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params

      assertCredentialSpace(auth.credentials, space)

      const spaceDid = await assertSpaceHost(ctx, space)

      // The writer set: accounts that have written to the space, maintained by
      // the authority from incoming notifyWrite calls. This is the sync
      // boundary — it enumerates writers, not readers.
      const writers = await ctx.actorStore.read(spaceDid, async (store) => {
        // Throws unless this host is the space's authority: the writer set is the
        // authority's to maintain and to answer for.
        await store.space.getActiveSpaceConfig(space)
        return store.space.listWriters(space, { limit, cursor })
      })

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: writers.length < limit ? undefined : writers.at(-1)?.did,
          repos: writers.map((writer) => ({
            did: writer.did as l.DidString,
            rev: writer.rev,
            hash: writer.hash,
          })),
        },
      }
    },
  })
}
