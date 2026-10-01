import type { l } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, assertSpaceHost } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRepos, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params
      assertCredentialSpace(auth.credentials, space)
      const spaceDid = await assertSpaceHost(ctx, space)
      const writers = await ctx.actorStore.read(spaceDid, async (store) => {
        await store.space.getActiveSpaceConfig(space)
        return store.space.listWriters(space, { limit, cursor })
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: writers.at(-1)?.spaceRev,
          repos: writers.map((writer) => ({
            did: writer.did as l.DidString,
            repoRev: writer.repoRev,
            hash: writer.hash,
            spaceRev: writer.spaceRev,
          })),
        },
      }
    },
  })
}
