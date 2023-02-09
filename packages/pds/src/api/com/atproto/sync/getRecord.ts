import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRecord(async ({ params }) => {
    const { did, collection, rkey } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const commit = params.commit
      ? CID.parse(params.commit)
      : await storage.getHead()
    if (!commit) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const proof = await repo.getRecords(storage, commit, [{ collection, rkey }])
    return {
      encoding: 'application/vnd.ipld.car',
      body: Buffer.from(proof),
    }
  })
}
