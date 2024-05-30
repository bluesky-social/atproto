import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { byteIterableToStream } from '@atproto/common'
import { blocksToCarStream } from '@atproto/repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlocks({
    auth: ctx.authVerifier.optionalAccessOrAdminToken,
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

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
