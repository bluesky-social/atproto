import { InvalidRequestError } from '@atproto/xrpc-server'
import { byteIterableToStream } from '@atproto/common'
import { Server } from '../../../../../lexicon'
import SqlRepoStorage, {
  RepoRootNotFoundError,
} from '../../../../../sql-repo-storage'
import AppContext from '../../../../../context'
import { isUserOrAdmin } from '../../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCheckout({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const storage = new SqlRepoStorage(ctx.db, did)
      let carStream: AsyncIterable<Uint8Array>
      try {
        carStream = await storage.getCarStream()
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
