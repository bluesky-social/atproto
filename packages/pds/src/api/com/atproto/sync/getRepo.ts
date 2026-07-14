import type stream from 'node:stream'
import {
  MINUTE,
  byteIterableToStream,
  coalesceByteStream,
} from '@atproto/common'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import {
  RepoRootNotFoundError,
  SqlRepoReader,
} from '../../../../actor-store/repo/sql-repo-reader.js'
import { AuthScope } from '../../../../auth-scope.js'
import { isUserOrAdmin } from '../../../../auth-verifier.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util.js'

const CAR_STREAM_CHUNK_SIZE = 64 * 1024

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getRepo, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // always allow
      },
    }),
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 6000,
    },
    handler: async ({ req, params, auth }) => {
      const { did, since } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const carStream = await getCarStream(ctx, did, since)

      return {
        encoding: 'application/vnd.ipld.car' as const,
        // @NOTE If the client asked for compression (via "accept-encoding"), we
        // coalesce the CAR stream into larger chunks to improve compression
        // efficiency. See https://github.com/bluesky-social/atproto/pull/5078
        //
        // @TODO This would be better handled by xrpc-server and/or the
        // compression middleware instead of manually coalescing the stream.
        body: req.headers['accept-encoding']
          ? coalesceByteStream(carStream, CAR_STREAM_CHUNK_SIZE)
          : carStream,
      }
    },
  })
}

export const getCarStream = async (
  ctx: AppContext,
  did: string,
  since?: string,
): Promise<stream.Readable> => {
  const actorDb = await ctx.actorStore.openDb(did)
  try {
    const storage = new SqlRepoReader(actorDb)
    const carIter = await storage.getCarStream(since)
    const carStream = byteIterableToStream(carIter)
    const closeDb = () => actorDb.close()
    carStream.on('error', closeDb)
    carStream.on('close', closeDb)
    return carStream
  } catch (err) {
    await actorDb.close()
    if (err instanceof RepoRootNotFoundError) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    throw err
  }
}
