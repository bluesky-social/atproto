import { byteIterableToStream } from '@atproto/common'
import {
  COMMIT_MAC_PROFILE,
  type SerializedRecord,
  writeRepoStar,
} from '@atproto/space'
import type { SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { SpaceReader } from '../../../../actor-store/space/reader.js'
import { AuthScope } from '../../../../auth-scope.js'
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
  server.add(com.atproto.space.getRepo, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      additional: [AuthScope.Takendown],
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

      // Held open for the life of the stream so records page out lazily.
      const actorDb = await ctx.actorStore.openDb(repo)
      try {
        const reader = new SpaceReader(actorDb)
        const state = await reader.getRepoState(space)
        const commit = buildCommit({ spaceUri: space, repo, state })
        if (!commit) {
          throw new InvalidRequestError(
            `Could not find repo for space: ${space}`,
            'RepoNotFound',
          )
        }

        const starStream = byteIterableToStream(
          writeRepoStar(commit, readRecords(reader, space)),
        )
        const closeDb = () => actorDb.close()
        starStream.on('error', closeDb)
        starStream.on('close', closeDb)

        return {
          encoding: 'application/vnd.dasl.star',
          body: starStream,
          headers: commitMacHeaders(commit, mac),
        }
      } catch (err) {
        await actorDb.close()
        throw err
      }
    },
  })
}

async function* readRecords(
  reader: SpaceReader,
  space: SpaceRefString,
): AsyncGenerator<SerializedRecord> {
  for await (const record of reader.streamRecords(space)) {
    yield {
      collection: record.collection,
      rkey: record.rkey,
      bytes: record.value,
    }
  }
}
