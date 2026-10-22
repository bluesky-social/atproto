import { byteIterableToStream } from '@atproto/common'
import {
  COMMIT_MAC_TYPE,
  type SerializedRecord,
  serializeRepo,
} from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { SpaceReader } from '../../../../actor-store/space/reader.js'
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
  server.add(com.atproto.space.getRepo, {
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
          serializeRepo(commit, readRecords(reader, space)),
        )
        const closeDb = () => actorDb.close()
        starStream.on('error', closeDb)
        starStream.on('close', closeDb)

        return {
          encoding: 'application/octet-stream' as const,
          body: starStream,
          headers: commitMacHeaders(sharedSecret, commit),
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
  space: string,
): AsyncGenerator<SerializedRecord> {
  for await (const record of reader.streamRecords(space)) {
    yield {
      collection: record.collection,
      rkey: record.rkey,
      bytes: record.value,
    }
  }
}
