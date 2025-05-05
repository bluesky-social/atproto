import stream from 'node:stream'
import { byteIterableToStream } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  RepoRootNotFoundError,
  SqlRepoReader,
} from '../../../../actor-store/repo/sql-repo-reader'
import { AuthScope } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepo({
    auth: ctx.authVerifier.optionalAccessOrAdminToken({
      additional: [AuthScope.Takendown],
    }),
    handler: async ({ params, auth }) => {
      const { did, since } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

      const carStream = await getCarStream(ctx, did, since)

      return {
        encoding: 'application/vnd.ipld.car',
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
    carStream = byteIterableToStream(carIter)
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
