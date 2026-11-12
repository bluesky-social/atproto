import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertActiveSpaceHost,
  assertCredentialSpace,
  toSpaceRef,
} from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listWriters, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ params, auth }) => {
      const { space, limit, cursor } = params
      const ref = toSpaceRef(space)
      assertCredentialSpace(auth.credentials, ref)
      await assertActiveSpaceHost(ctx, ref)
      const writers = await ctx.actorStore.read(ref.spaceDid, async (store) => {
        await store.space.getActiveSpacePolicy(space)
        return store.space.listWriters(space, { limit, cursor })
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: writers.at(-1)?.spaceRev,
          repos: writers.map((writer) =>
            writer.removedAt
              ? com.atproto.space.defs.repoRemoved.$build({
                  repo: writer.did,
                  spaceRev: writer.spaceRev,
                })
              : com.atproto.space.defs.repoWrite.$build({
                  repo: writer.did,
                  repoRev: writer.repoRev,
                  data: writer.data,
                  spaceRev: writer.spaceRev,
                }),
          ),
        },
      }
    },
  })
}
