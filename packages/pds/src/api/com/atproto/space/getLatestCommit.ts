import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceRead, buildSignedCommit } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getLatestCommit, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo } = params

      assertSpaceRead(auth, space)

      const commit = await ctx.actorStore.read(repo, async (store) => {
        const state = await store.space.getRepoState(space)
        const keypair = await store.keypair()
        return buildSignedCommit({
          spaceUri: space,
          author: repo,
          state,
          keypair,
        })
      })

      return {
        encoding: 'application/json' as const,
        body: { commit },
      }
    },
  })
}
