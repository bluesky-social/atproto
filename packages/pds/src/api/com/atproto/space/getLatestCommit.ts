import { COMMIT_MAC_TYPE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  buildCommit,
  commitMacHeaders,
  getSpaceMacSecret,
  isSpaceSelfRead,
} from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getLatestCommit, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth, req, res }) => {
      const { space, repo } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const sharedSecret = await getSpaceMacSecret(ctx, {
        req,
        res,
        auth,
        repo,
        type: COMMIT_MAC_TYPE,
      })

      const commit = await ctx.actorStore.read(repo, async (store) =>
        buildCommit({
          spaceUri: space,
          repo,
          state: await store.space.getRepoState(space),
        }),
      )

      if (!commit) {
        throw new InvalidRequestError(
          `Could not find repo for space: ${space}`,
          'RepoNotFound',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          commit,
        },
        headers: commitMacHeaders(sharedSecret, commit),
      }
    },
  })
}
