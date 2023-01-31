import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params }) {
    yield {}
    // const { dids, lastSeen } = params
    // const storage = new SqlRepoStorage(ctx.db, did)
    // const head = await storage.getHead()
    // if (head === null) {
    //   throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    // }
    // const fromCid = from ? CID.parse(from) : null
    // const diff = await repo.getDiff(storage, head, fromCid)
    // return {
    //   encoding: 'application/vnd.ipld.car',
    //   body: Buffer.from(diff),
    // }
  })
}
