import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { blocksToCarStream } from '@atproto/repo'
import { byteIterableToStream } from '@atproto/common'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlocks({
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
      const cids = params.cids.map((c) => CID.parse(c))
      const storage = new SqlRepoStorage(ctx.db, did)
      const got = await storage.getBlocks(cids)
      if (got.missing.length > 0) {
        const missingStr = got.missing.map((c) => c.toString())
        throw new InvalidRequestError(`Could not find cids: ${missingStr}`)
      }
      const car = blocksToCarStream(null, got.blocks)

      return {
        encoding: 'application/vnd.ipld.car',
        body: byteIterableToStream(car),
      }
    },
  })
}
