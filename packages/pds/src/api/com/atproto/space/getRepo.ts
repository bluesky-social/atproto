import { byteIterableToStream } from '@atproto/common'
import { parseCid } from '@atproto/lex-data'
import { type SerializedRecord, serializeRepo } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { SpaceReader } from '../../../../actor-store/space/reader.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, buildSignedCommit, isSpaceSelfRead } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRepo, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, excludeValues } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      // Held open for the life of the stream so records page out lazily.
      const actorDb = await ctx.actorStore.openDb(repo)
      try {
        const reader = new SpaceReader(actorDb)
        const state = await reader.getRepoState(space)
        const commit = await buildSignedCommit({
          spaceUri: space,
          author: repo,
          state,
          keypair: await ctx.actorStore.keypair(repo),
        })
        if (!commit) {
          throw new InvalidRequestError(
            `Could not find repo for space: ${space}`,
            'RepoNotFound',
          )
        }

        const carStream = byteIterableToStream(
          serializeRepo(commit, readRecords(reader, space, excludeValues), {
            excludeValues,
          }),
        )
        const closeDb = () => actorDb.close()
        carStream.on('error', closeDb)
        carStream.on('close', closeDb)

        return {
          encoding: 'application/vnd.ipld.car' as const,
          body: carStream,
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
  excludeValues?: boolean,
): AsyncGenerator<SerializedRecord> {
  for await (const record of reader.streamRecords(space, { excludeValues })) {
    yield {
      collection: record.collection,
      rkey: record.rkey,
      cid: parseCid(record.cid, { flavor: 'cbor' }),
      // Absent under excludeValues, where serializeRepo writes the index and no
      // record blocks, so the bytes are never read.
      bytes: record.value ?? new Uint8Array(),
    }
  }
}
