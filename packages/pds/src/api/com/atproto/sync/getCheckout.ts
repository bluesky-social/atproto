import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { byteIterableToStream } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCheckout(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const commit = params.commit
      ? CID.parse(params.commit)
      : await storage.getHead()
    if (!commit) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const checkout = repo.getCheckout(storage, commit)
    return {
      encoding: 'application/vnd.ipld.car',
      body: byteIterableToStream(checkout),
    }
  })
}
