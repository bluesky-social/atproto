import { COMMIT_MAC_PROFILE } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import {
  assertSpaceRead,
  buildCommit,
  commitMacHeaders,
  getSpaceMacRequest,
  isSpaceUserOrAdmin,
  toSpaceRef,
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

      assertSpaceRead(auth, toSpaceRef(space), repo)
      await assertRepoAvailability(ctx, repo, isSpaceUserOrAdmin(auth, repo))

      const mac = await getSpaceMacRequest(ctx, {
        req,
        res,
        auth,
        repo,
        profile: COMMIT_MAC_PROFILE,
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
        encoding: 'application/json',
        body: {
          commit,
        },
        headers: commitMacHeaders(commit, mac),
      }
    },
  })
}
