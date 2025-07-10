import stream from 'node:stream'
import { byteIterableToStream } from '@atproto/common'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { SqlRepoReader } from '../../../../actor-store/repo/sql-repo-reader'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRecord({
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did, collection, rkey } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      // must open up the db outside of store interface so that we can close the file handle after finished streaming
      const actorDb = await ctx.actorStore.openDb(did)

      let carStream: stream.Readable
      try {
        const storage = new SqlRepoReader(actorDb)
        const commit = await storage.getRoot()

        if (!commit) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
        const carIter = repo.getRecords(storage, commit, [{ collection, rkey }])
        carStream = byteIterableToStream(carIter)
      } catch (err) {
        actorDb.close()
        throw err
      }
      const closeDb = () => actorDb.close()
      carStream.on('error', closeDb)
      carStream.on('close', closeDb)

      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
