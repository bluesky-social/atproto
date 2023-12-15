import stream from 'stream'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  RepoRootNotFoundError,
  SqlRepoReader,
} from '../../../../actor-store/repo/sql-repo-reader'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepo({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, auth }) => {
      const { did, since } = params
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
        const available = await ctx.accountManager.isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

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
    carStream = await storage.getCarStream(since)
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
