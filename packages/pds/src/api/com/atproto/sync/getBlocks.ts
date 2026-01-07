import { byteIterableToStream } from '@atproto/common'
import { parseCid } from '@atproto/lex-data'
import { blocksToCarStream } from '@atproto/repo'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getBlocks, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const cids = params.cids.map(parseCid)
      const got = await ctx.actorStore.read(did, (store) =>
        store.repo.storage.getBlocks(cids),
      )
      if (got.missing.length > 0) {
        const missingStr = got.missing.map((c) => c.toString())
        throw new InvalidRequestError(`Could not find cids: ${missingStr}`)
      }
      const car = blocksToCarStream(null, got.blocks)

      return {
        encoding: 'application/vnd.ipld.car' as const,
        body: byteIterableToStream(car),
      }
    },
  })
}
