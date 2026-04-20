import stream from 'node:stream'
import { byteIterableToStream, coalesceByteIterable } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import {
  RepoRootNotFoundError,
  SqlRepoReader,
} from '../../../../actor-store/repo/sql-repo-reader'
import { AuthScope } from '../../../../auth-scope'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getRepo, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did, since } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const carStream = await getCarStream(ctx, did, since)

      // `atproto-car-block-order` acts as a hint for consumers - in the future it can be implicit/assumed
      return {
        encoding: 'application/vnd.ipld.car' as const,
        headers:
          since === undefined
            ? { 'atproto-car-block-order': 'mst-preorder' }
            : undefined,
        body: carStream,
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
  let carStream: stream.Readable
  try {
    const storage = new SqlRepoReader(actorDb)
    const carIter = await storage.getCarStream(since)
    // carIter yields many small chunks. Without coalesceByteIterable, the small chunks would
    // end up being transmitted in separate TCP packets (assuming TCP_NODELAY), which would
    // incur a lot of overhead.
    carStream = byteIterableToStream(coalesceByteIterable(carIter))
  } catch (err) {
    await actorDb.close()
    if (err instanceof RepoRootNotFoundError) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    throw err
  }
  const closeDb = () => actorDb.close()
  carStream.on('error', closeDb)
  carStream.on('close', closeDb)
  return carStream
}
