import { l } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, isSpaceSelfRead } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listBlobs, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, since, limit, cursor } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const cids = await ctx.actorStore.read(repo, (store) =>
        store.space.listBlobs(space, { since, cursor, limit }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cids: cids as l.CidString[],
          cursor: cids.length < limit ? undefined : cids.at(-1),
        },
      }
    },
  })
}
