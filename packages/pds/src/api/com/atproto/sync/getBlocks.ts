import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { blocksToCar } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlocks(async ({ params }) => {
    const { did } = params
    const cids = params.cids.map((c) => CID.parse(c))
    const storage = new SqlRepoStorage(ctx.db, did)
    const got = await storage.getBlocks(cids)
    if (got.missing.length > 0) {
      const missingStr = got.missing.map((c) => c.toString())
      throw new InvalidRequestError(`Could not find cids: ${missingStr}`)
    }
    const car = await blocksToCar(null, got.blocks)

    return {
      encoding: 'application/vnd.ipld.car',
      body: Buffer.from(car),
    }
  })
}
