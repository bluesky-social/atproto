import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { byteIterableToStream } from '@atproto/common'
import { blocksToCarStream } from '@atproto/repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlocks({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
        const available = await ctx.accountManager.isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const cids = params.cids.map((c) => CID.parse(c))
      const got = await ctx.actorStore.read(did, (store) =>
        store.repo.storage.getBlocks(cids),
      )
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
