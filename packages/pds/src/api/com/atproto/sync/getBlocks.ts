import { CID } from 'multiformats/cid'
import { byteIterableToStream } from '@atproto/common'
import { blocksToCarStream } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlocks({
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

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
