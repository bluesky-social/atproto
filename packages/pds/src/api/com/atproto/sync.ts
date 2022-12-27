import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { def as common } from '@atproto/common'
import { Repo } from '@atproto/repo'
import SqlRepoStorage from '../../../sql-repo-storage'
import AppContext from '../../../context'
import { CID } from 'multiformats/cid'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRoot(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const root = await storage.getHead()
    if (root === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    return {
      encoding: 'application/json',
      body: { root: root.toString() },
    }
  })

  server.com.atproto.sync.getRepo(async ({ params }) => {
    const { did, from = null } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const root = await storage.getHead()
    if (root === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const repo = await Repo.load(storage, root)
    const fromCid = from ? common.strToCid.parse(from) : null
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.sync.getCheckout(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const commit = params.commit
      ? CID.parse(params.commit)
      : await storage.getHead()
    if (!commit) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const blocks = await storage.getBlocksForCommits([commit])

    const repo = await Repo.load(storage, root)
    const fromCid = from ? common.strToCid.parse(from) : null
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.sync.updateRepo(async () => {
    throw new InvalidRequestError('Not implemented')
  })
}
