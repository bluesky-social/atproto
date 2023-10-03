import { InvalidRequestError } from '@atproto/xrpc-server'
import { byteIterableToStream } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { isUserOrAdmin } from '../../../../auth'
import { RepoRootNotFoundError } from '../../../../actor-store/repo/sql-repo-reader'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepo({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did, since } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const storage = ctx.actorStore.reader(did).repo.storage
      let carStream: AsyncIterable<Uint8Array>
      try {
        carStream = await storage.getCarStream(since)
      } catch (err) {
        if (err instanceof RepoRootNotFoundError) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
        throw err
      }

      return {
        encoding: 'application/vnd.ipld.car',
        body: byteIterableToStream(carStream),
      }
    },
  })
}
